"""
Supabase logging client.

PRODUCT:  LearnSpace  (also copyable into EduOS — see SETUP.md, Phase 1C)
PATH:     app/core/logging_client.py   (NEW FILE)

Sends structured logs to a Supabase table (app_logs) over HTTP on a
background thread, so logging never blocks a request and a Supabase
outage can never take the app down (logs are dropped under pressure).

Required env vars (set on Railway):
    SUPABASE_URL          e.g. https://abcd.supabase.co
    SUPABASE_SERVICE_KEY  the service_role key (backend only, never frontend)
    SERVICE_NAME          "learnspace" or "eduos"
"""

import os
import queue
import threading
from datetime import datetime, timezone

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SERVICE_NAME = os.getenv("SERVICE_NAME", "learnspace")

_LOG_ENDPOINT = f"{SUPABASE_URL}/rest/v1/app_logs" if SUPABASE_URL else ""
_ENABLED = bool(_LOG_ENDPOINT and SUPABASE_SERVICE_KEY)

# Bounded queue: if we ever fall behind, we drop logs instead of growing memory.
_log_queue: "queue.Queue[dict]" = queue.Queue(maxsize=1000)

# These are the only top-level fields on the table; anything else goes in detail.
_TOP_LEVEL = ("user_id", "role", "method", "path", "status_code", "duration_ms", "ip")


def _worker():
    with httpx.Client(timeout=5.0) as client:
        while True:
            record = _log_queue.get()
            if record is None:
                break
            try:
                client.post(
                    _LOG_ENDPOINT,
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal",
                    },
                    json=record,
                )
            except Exception:
                # Logging must never raise. Swallow everything.
                pass
            finally:
                _log_queue.task_done()


if _ENABLED:
    threading.Thread(target=_worker, daemon=True).start()


def log_event(level: str, event: str, **fields):
    """
    Queue a structured log line.

    ALWAYS call this from inside a function body (a route handler or
    middleware) — never at module top level. At import time there is no
    request context, which is exactly what caused the earlier boot crash.

    Examples:
        log_event("info", "auth.login", user_id=str(user.id), role=user.role.value)
        log_event("warning", "auth.login_failed", detail_email=email)
    """
    if not _ENABLED:
        return

    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "service": SERVICE_NAME,
        "level": level,
        "event": event,
    }
    for key in _TOP_LEVEL:
        if key in fields:
            record[key] = fields.pop(key)
    if fields:
        # Everything else (detail_*, arbitrary kwargs) lands in the jsonb column.
        record["detail"] = fields

    try:
        _log_queue.put_nowait(record)
    except queue.Full:
        pass  # drop rather than block
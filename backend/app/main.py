import asyncio
import logging
import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from app.core.logging_client import log_event
from app.api.v1.endpoints import (
    auth, users, assignments, submissions, grades, attendance,
    exams, notes, events, seed, ai, timetable, coursebooks,
    parents, admin,
)
from app.db.database import engine, Base, ensure_schema, SessionLocal
from app.services.eduos_sync import sync_parent_links, SyncDisabled

ensure_schema(engine)          # must precede create_all — SQLAlchemy won't create the schema
Base.metadata.create_all(bind=engine)

# 1) create the app FIRST
app = FastAPI(
    title="Nyxion LearnSpace API",
    version="1.0.0",
    description="Assignment & Learning Portal for Nyxion EduOS",
)

# 2) CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3) logging middleware — must come AFTER app = FastAPI(...)
@app.middleware("http")
async def access_logger(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log_event("error", "request.unhandled",
                  method=request.method, path=request.url.path, status_code=500,
                  duration_ms=int((time.perf_counter() - start) * 1000),
                  ip=request.client.host if request.client else None)
        raise
    log_event("info" if response.status_code < 400 else "warning", "request",
              method=request.method, path=request.url.path,
              status_code=response.status_code,
              duration_ms=int((time.perf_counter() - start) * 1000),
              ip=request.client.host if request.client else None)
    return response

# 4) routers
app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/v1/users",       tags=["users"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(grades.router,      prefix="/api/v1/grades",      tags=["grades"])
app.include_router(attendance.router,  prefix="/api/v1/attendance",  tags=["attendance"])
app.include_router(exams.router,       prefix="/api/v1/exams",       tags=["exams"])
app.include_router(notes.router,       prefix="/api/v1/notes",       tags=["notes"])
app.include_router(events.router,      prefix="/api/v1/events",      tags=["events"])
app.include_router(seed.router,        prefix="/api/v1/seed",        tags=["seed"])
app.include_router(ai.router,          prefix="/api/v1/ai",          tags=["ai"])
app.include_router(timetable.router,   prefix="/api/v1/timetable",   tags=["timetable"])
app.include_router(coursebooks.router, prefix="/api/v1/coursebooks", tags=["coursebooks"])
app.include_router(parents.router,     prefix="/api/v1/parents",     tags=["parents"])
app.include_router(admin.router,       prefix="/api/v1/admin",       tags=["admin"])

# 5) uploads + health
# In Docker this is the absolute /uploads volume; running locally on Windows
# or macOS that path is not writable, so fall back to ./uploads.
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/uploads")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except OSError:
    UPLOAD_DIR = os.path.abspath("uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/health")
def health():
    return {"status": "ok", "service": "Nyxion LearnSpace"}


# 6) EduOS parent-link sync
# Runs on a timer because EduOS is the system of record for who a student's
# parent is; see app/services/eduos_sync.py. Disabled unless both EDUOS_API_URL
# and EDUOS_SERVICE_TOKEN are set.
sync_logger = logging.getLogger("learnspace.eduos_sync")
SYNC_INTERVAL_MINUTES = int(os.getenv("EDUOS_SYNC_INTERVAL_MINUTES", "30"))
SYNC_STATUS = {"last_run": None, "last_result": None, "last_error": None}


def _run_parent_sync_once():
    db = SessionLocal()
    try:
        report = sync_parent_links(db)
        SYNC_STATUS.update({"last_result": report, "last_error": None})
        sync_logger.info(
            "EduOS parent sync: %s parents, +%s links, -%s links, %s unmatched parents, %s unmatched children",
            report["parents_synced"], report["links_created"], report["links_removed"],
            len(report["unmatched_parents"]), len(report["unmatched_children"]),
        )
        return report
    finally:
        db.close()


async def _parent_sync_loop():
    interval = max(SYNC_INTERVAL_MINUTES, 1) * 60
    while True:
        try:
            # The sync is blocking (httpx + SQLAlchemy), so keep it off the event loop.
            await asyncio.to_thread(_run_parent_sync_once)
        except SyncDisabled as exc:
            sync_logger.info("EduOS parent sync disabled: %s", exc)
            return
        except Exception as exc:
            # Never let a failed run kill the loop — the next tick retries.
            SYNC_STATUS["last_error"] = str(exc)
            sync_logger.exception("EduOS parent sync failed; retrying in %s minutes", interval // 60)
        finally:
            SYNC_STATUS["last_run"] = time.time()
        await asyncio.sleep(interval)


@app.on_event("startup")
async def start_parent_sync():
    if not os.getenv("EDUOS_API_URL") or not os.getenv("EDUOS_SERVICE_TOKEN"):
        sync_logger.info("EduOS parent sync not configured; skipping scheduler")
        return
    asyncio.create_task(_parent_sync_loop())


@app.get("/health/eduos-sync")
def health_eduos_sync():
    """Last sync outcome — the only way to notice a silently failing job."""
    return {
        "configured": bool(os.getenv("EDUOS_API_URL") and os.getenv("EDUOS_SERVICE_TOKEN")),
        "interval_minutes": SYNC_INTERVAL_MINUTES,
        **SYNC_STATUS,
    }
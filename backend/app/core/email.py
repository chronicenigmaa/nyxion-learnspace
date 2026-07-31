"""
Transactional email sender (Resend HTTP API).

PRODUCT:  LearnSpace
PATH:     app/core/email.py

Uses Resend's REST API rather than SMTP because Railway blocks outbound
SMTP ports on several plans. Sending is best-effort and never raises into a
request handler — callers check the returned bool and degrade gracefully.

Required env vars:
    RESEND_API_KEY   re_xxxxxxxx  (from resend.com/api-keys)
    MAIL_FROM        "Nyxion LearnSpace <noreply@yourdomain.com>"
                     The domain must be verified in Resend. Until you verify
                     one, use "onboarding@resend.dev" which only delivers to
                     the address that owns the Resend account.
    APP_BASE_URL     https://learnspace.yourdomain.com   (used to build links)
"""

import os
import html as html_lib

import httpx

from app.core.logging_client import log_event

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
MAIL_FROM = os.getenv("MAIL_FROM", "Nyxion LearnSpace <onboarding@resend.dev>")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip("/")

_RESEND_ENDPOINT = "https://api.resend.com/emails"


def email_enabled() -> bool:
    """True when the app can actually deliver mail."""
    return bool(RESEND_API_KEY)


def send_email(to: str, subject: str, html: str, text: str | None = None) -> bool:
    """
    Send one transactional email. Returns True on success, False on any
    failure (missing config, network error, provider rejection).
    """
    if not email_enabled():
        log_event("warning", "email.skipped", detail_to=to,
                  detail_reason="RESEND_API_KEY not set")
        return False

    payload = {"from": MAIL_FROM, "to": [to], "subject": subject, "html": html}
    if text:
        payload["text"] = text

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                _RESEND_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except Exception as exc:
        log_event("error", "email.failed", detail_to=to, detail_error=str(exc))
        return False

    if res.status_code >= 400:
        log_event("error", "email.rejected", detail_to=to,
                  status_code=res.status_code, detail_body=res.text[:400])
        return False

    log_event("info", "email.sent", detail_to=to, detail_subject=subject)
    return True


# ── Templates ──────────────────────────────────────────────────────────────
def _shell(heading: str, body_html: str) -> str:
    """Light, professional email shell matching the app theme."""
    return f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
            <span style="font-size:17px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">Nyxion</span>
            <span style="font-size:17px;font-weight:500;color:#4f46e5;"> LearnSpace</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">{heading}</h1>
            {body_html}
          </td></tr>
          <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
              This is an automated message from Nyxion LearnSpace.
              If you weren't expecting it you can safely ignore it.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def send_password_reset(to: str, name: str, reset_token: str) -> bool:
    link = f"{APP_BASE_URL}/auth/reset-password?token={reset_token}"
    safe_name = html_lib.escape(name or "there")
    body = f"""\
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
              Hi {safe_name}, we received a request to reset the password for your
              Nyxion LearnSpace account. Click the button below to choose a new one.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr><td style="background:#4f46e5;border-radius:8px;">
                <a href="{link}"
                   style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;
                          color:#ffffff;text-decoration:none;">Reset my password</a>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">
              This link expires in <strong>1 hour</strong>. If the button doesn't work,
              paste this address into your browser:
            </p>
            <p style="margin:0;font-size:12px;color:#4f46e5;word-break:break-all;">{link}</p>"""
    text = (
        f"Hi {name or 'there'},\n\n"
        f"Reset your Nyxion LearnSpace password here (expires in 1 hour):\n{link}\n\n"
        "If you didn't request this, you can ignore this email."
    )
    return send_email(to, "Reset your LearnSpace password", _shell("Reset your password", body), text)


def send_account_created(to: str, name: str, role: str, temp_password: str | None = None) -> bool:
    login_link = f"{APP_BASE_URL}/auth/login"
    safe_name = html_lib.escape(name or "there")
    safe_role = html_lib.escape(role.replace("_", " ").title())
    credentials_block = ""
    if temp_password:
        credentials_block = f"""\
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                   style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <tr><td style="padding:16px 18px;">
                <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Email</p>
                <p style="margin:0 0 14px;font-size:14px;color:#0f172a;font-family:monospace;">{html_lib.escape(to)}</p>
                <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Temporary password</p>
                <p style="margin:0;font-size:14px;color:#0f172a;font-family:monospace;">{html_lib.escape(temp_password)}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 20px;font-size:13px;color:#b45309;line-height:1.6;">
              Please sign in and change this password immediately.
            </p>"""

    body = f"""\
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
              Hi {safe_name}, a <strong>{safe_role}</strong> account has been created for you
              on Nyxion LearnSpace.
            </p>
            {credentials_block}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
              <tr><td style="background:#4f46e5;border-radius:8px;">
                <a href="{login_link}"
                   style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;
                          color:#ffffff;text-decoration:none;">Sign in</a>
              </td></tr>
            </table>"""
    return send_email(to, "Your Nyxion LearnSpace account", _shell("Welcome to LearnSpace", body))

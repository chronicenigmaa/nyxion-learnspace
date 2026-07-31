"""
Super admin management.

PRODUCT:  LearnSpace
PATH:     app/api/v1/endpoints/admin.py   (NEW FILE)

Two ways a super admin comes into existence:

  1. BOOTSTRAP (once, for the very first one)
     POST /api/v1/admin/bootstrap  with header  X-Bootstrap-Secret: <BOOTSTRAP_SECRET>
     Only works while ZERO active super admins exist. After the first one is
     created this route permanently refuses, so a leaked secret cannot be
     replayed later to mint a second one.

  2. IN-APP (every one after that)
     POST /api/v1/admin/super-admins  as a logged-in super admin.

Deleting/deactivating is guarded so you can never lock yourself out: the last
remaining active super admin cannot be demoted, disabled, or deleted.
"""

import os
import random
import secrets
import string
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.email import email_enabled, send_account_created
from app.core.logging_client import log_event
from app.core.security import get_current_user, hash_password
from app.db.database import get_db
from app.models.models import ParentChild, Role, User

router = APIRouter()

AVATAR_COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"]
MIN_ADMIN_PASSWORD_LENGTH = 10


# ── Request / response models ──────────────────────────────────────────────
class BootstrapRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=MIN_ADMIN_PASSWORD_LENGTH, max_length=128)


class CreateSuperAdminRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # Omit to have the server generate a strong password and email it over.
    password: str | None = Field(default=None, min_length=MIN_ADMIN_PASSWORD_LENGTH, max_length=128)
    send_invite_email: bool = True


class SetActiveRequest(BaseModel):
    is_active: bool


# ── Helpers ────────────────────────────────────────────────────────────────
def _super_admin_only(user: User) -> None:
    if user.role != Role.super_admin:
        raise HTTPException(status_code=403, detail="Super admins only")


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _active_super_admin_count(db: Session) -> int:
    return db.query(User).filter(
        User.role == Role.super_admin, User.is_active.is_(True)
    ).count()


def _serialize(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role.value if user.role else None,
        "is_active": user.is_active,
        "school_id": user.school_id,
        "avatar_color": user.avatar_color,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _find_user(db: Session, user_id: str) -> User:
    try:
        uid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid user id")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _create_super_admin(db: Session, name: str, email: str, password: str) -> User:
    normalized = email.strip().lower()
    if db.query(User).filter(func.lower(User.email) == normalized).first():
        raise HTTPException(status_code=400, detail="An account with that email already exists")

    user = User(
        name=name.strip(),
        email=normalized,
        password_hash=hash_password(password),
        role=Role.super_admin,
        avatar_color=random.choice(AVATAR_COLORS),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── 1. Bootstrap the first super admin ─────────────────────────────────────
@router.post("/bootstrap")
def bootstrap_super_admin(
    req: BootstrapRequest,
    db: Session = Depends(get_db),
    x_bootstrap_secret: str = Header(default=""),
):
    expected = os.getenv("BOOTSTRAP_SECRET", "")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Bootstrap is disabled. Set BOOTSTRAP_SECRET on the server to enable it.",
        )
    if not secrets.compare_digest(x_bootstrap_secret, expected):
        log_event("warning", "admin.bootstrap_denied", detail_reason="bad_secret")
        raise HTTPException(status_code=403, detail="Invalid bootstrap secret")

    if _active_super_admin_count(db) > 0:
        log_event("warning", "admin.bootstrap_denied", detail_reason="already_exists")
        raise HTTPException(
            status_code=409,
            detail="A super admin already exists. Sign in and use Users → Admins to add more.",
        )

    user = _create_super_admin(db, req.name, req.email, req.password)
    log_event("info", "admin.bootstrapped", user_id=str(user.id))
    return {"message": "Super admin created. You can sign in now.", "user": _serialize(user)}


# ── 2. List super admins ───────────────────────────────────────────────────
@router.get("/super-admins")
def list_super_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _super_admin_only(current_user)
    admins = (
        db.query(User)
        .filter(User.role.in_([Role.super_admin, Role.school_admin]))
        .order_by(User.role, User.created_at)
        .all()
    )
    return {
        "admins": [_serialize(a) for a in admins],
        "current_user_id": str(current_user.id),
        "email_enabled": email_enabled(),
    }


# ── 3. Create another super admin ──────────────────────────────────────────
@router.post("/super-admins")
def create_super_admin(
    req: CreateSuperAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _super_admin_only(current_user)

    generated = req.password is None
    password = req.password or _generate_password()
    user = _create_super_admin(db, req.name, req.email, password)

    delivered = False
    if req.send_invite_email:
        delivered = send_account_created(user.email, user.name, "super_admin", password)

    log_event("info", "admin.super_admin_created", user_id=str(current_user.id),
              role=current_user.role.value, detail_created=str(user.id),
              detail_emailed=delivered)

    response = {
        "message": "Super admin created.",
        "user": _serialize(user),
        "invite_emailed": delivered,
    }
    # If we generated the password and could not email it, the creating admin
    # is the only one who can pass it on — so it is returned exactly once here.
    if generated and not delivered:
        response["temporary_password"] = password
        response["message"] = (
            "Super admin created, but the invite email could not be sent. "
            "Share this password securely — it will not be shown again."
        )
    return response


# ── 4. Enable / disable an admin ───────────────────────────────────────────
@router.patch("/users/{user_id}/active")
def set_user_active(
    user_id: str,
    req: SetActiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _super_admin_only(current_user)
    user = _find_user(db, user_id)

    if str(user.id) == str(current_user.id) and not req.is_active:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    if (
        not req.is_active
        and user.role == Role.super_admin
        and user.is_active
        and _active_super_admin_count(db) <= 1
    ):
        raise HTTPException(status_code=400, detail="Cannot disable the last active super admin")

    user.is_active = req.is_active
    db.commit()
    db.refresh(user)
    log_event("info", "admin.user_active_changed", user_id=str(current_user.id),
              role=current_user.role.value, detail_target=str(user.id),
              detail_is_active=req.is_active)
    return _serialize(user)


# ── 5. Delete a super admin ────────────────────────────────────────────────
@router.delete("/super-admins/{user_id}")
def delete_super_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _super_admin_only(current_user)
    user = _find_user(db, user_id)

    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if user.role != Role.super_admin:
        raise HTTPException(status_code=400, detail="That user is not a super admin")
    if user.is_active and _active_super_admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last active super admin")

    db.query(ParentChild).filter(ParentChild.parent_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    log_event("info", "admin.super_admin_deleted", user_id=str(current_user.id),
              role=current_user.role.value, detail_deleted=user_id)
    return {"message": "Super admin deleted"}


# ── 6. Status probe (unauthenticated, used by the setup screen) ────────────
@router.get("/setup-status")
def setup_status(db: Session = Depends(get_db)):
    """Tells the frontend whether the one-time bootstrap screen should show."""
    return {
        "needs_bootstrap": _active_super_admin_count(db) == 0,
        "bootstrap_enabled": bool(os.getenv("BOOTSTRAP_SECRET", "")),
        "email_enabled": email_enabled(),
    }

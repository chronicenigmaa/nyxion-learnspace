import json
import os
import uuid
from urllib import error, request as urllib_request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from app.db.database import get_db
from app.models.models import User, Role, Assignment, Attendance, Exam, ExamAttempt, Note, Submission
from datetime import datetime, timedelta
from app.core.security import verify_password, hash_password, create_access_token, get_current_user, SECRET_KEY, ALGORITHM, oauth2_scheme, decode_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"
    school_id: str = None
    subject: str = None
    class_name: str = None
    roll_number: str = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    role: str
    email: str


class SSORequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def is_eduos_managed_email(email: str | None) -> bool:
    return bool(email and email.strip().lower().endswith("@alnooracademy.com"))


def normalize_role(role: str | None) -> Role:
    if role in (Role.student.value, Role.teacher.value, Role.school_admin.value, Role.super_admin.value):
        return Role(role)
    if role == "admin":
        return Role.school_admin
    return Role.student


def normalize_student_class_name(class_name: str | None, section: str | None = None) -> str | None:
    raw_class = str(class_name or "").strip()
    raw_section = str(section or "").strip().upper()
    if not raw_class:
        return None

    compact = raw_class.lower().replace("class", "").replace(" ", "").replace("-", "")
    if raw_section and compact.endswith(raw_section.lower()):
        compact = compact[:-len(raw_section)]

    if compact.isdigit():
        return f"Class {compact}{raw_section}"

    if raw_class.lower().startswith("class "):
        return raw_class

    if raw_section:
        return f"Class {raw_class}{raw_section}"

    return raw_class


def reassign_user_records(db: Session, source_user_id, target_user_id) -> None:
    db.query(Submission).filter(Submission.student_id == source_user_id).update(
        {Submission.student_id: target_user_id},
        synchronize_session=False,
    )
    db.query(Attendance).filter(Attendance.student_id == source_user_id).update(
        {Attendance.student_id: target_user_id},
        synchronize_session=False,
    )
    db.query(ExamAttempt).filter(ExamAttempt.student_id == source_user_id).update(
        {ExamAttempt.student_id: target_user_id},
        synchronize_session=False,
    )
    db.query(Assignment).filter(Assignment.teacher_id == source_user_id).update(
        {Assignment.teacher_id: target_user_id},
        synchronize_session=False,
    )
    db.query(Note).filter(Note.teacher_id == source_user_id).update(
        {Note.teacher_id: target_user_id},
        synchronize_session=False,
    )
    db.query(Exam).filter(Exam.teacher_id == source_user_id).update(
        {Exam.teacher_id: target_user_id},
        synchronize_session=False,
    )
    db.query(Attendance).filter(Attendance.marked_by == source_user_id).update(
        {Attendance.marked_by: target_user_id},
        synchronize_session=False,
    )
    db.query(Submission).filter(Submission.graded_by == source_user_id).update(
        {Submission.graded_by: target_user_id},
        synchronize_session=False,
    )


def issue_token_response(user: User) -> TokenResponse:
    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "email": user.email,
        "name": user.name,
        "school_id": user.school_id,
    })
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        name=user.name,
        role=user.role.value,
        email=user.email
    )


def sync_user_from_identity(
    db: Session,
    *,
    email: str,
    password: str | None,
    name: str | None,
    role: str | None,
    school_id: str | None = None,
    class_name: str | None = None,
    subject: str | None = None,
    roll_number: str | None = None,
    external_user_id: str | None = None,
) -> User:
    normalized_role = normalize_role(role)
    external_uuid = None
    if normalized_role == Role.student and external_user_id:
        try:
            external_uuid = uuid.UUID(str(external_user_id))
        except (ValueError, TypeError):
            external_uuid = None

    user = db.query(User).filter(User.id == external_uuid).first() if external_uuid else None
    email_user = db.query(User).filter(User.email == email).first()

    if user and email_user and email_user.id != user.id:
        reassign_user_records(db, email_user.id, user.id)
        db.delete(email_user)
        db.flush()
    elif not user:
        user = email_user

    if not user:
        user = User(
            id=external_uuid or None,
            email=email,
            password_hash=hash_password(password or email),
        )
        db.add(user)

    user.name = name or user.name or email.split("@")[0].replace(".", " ").title()
    if password:
        user.password_hash = hash_password(password)
    user.role = normalized_role
    user.school_id = school_id or user.school_id
    user.class_name = class_name or user.class_name
    user.subject = subject or user.subject
    user.roll_number = roll_number or user.roll_number
    user.avatar_color = user.avatar_color or "#6366f1"
    user.is_active = True

    db.commit()
    db.refresh(user)
    return user


def authenticate_with_eduos(email: str, password: str) -> dict | None:
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    if not eduos_api_url:
        return None

    payload = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib_request.Request(
        f"{eduos_api_url}/api/v1/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))
            return data.get("user")
    except error.HTTPError as exc:
        if exc.code in (400, 401, 403, 404):
            return None
        raise
    except (error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def build_eduos_session_token(app_token: str) -> str | None:
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    if not eduos_api_url:
        return None

    try:
        payload = decode_access_token(app_token)
    except Exception:
        return None

    eduos_sub = payload.get("eduos_sub")
    if not eduos_sub:
        return None

    return jwt.encode(
        {
            "sub": eduos_sub,
            "school_id": payload.get("school_id"),
            "role": payload.get("role"),
            "exp": datetime.utcnow() + timedelta(minutes=10),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def fetch_eduos_student_context(app_token: str, current_user: User) -> tuple[str | None, str | None]:
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    eduos_token = build_eduos_session_token(app_token)
    if not eduos_api_url or not eduos_token:
        return None, None

    req = urllib_request.Request(
        f"{eduos_api_url}/api/v1/students/",
        headers={"Authorization": f"Bearer {eduos_token}"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(req, timeout=10) as res:
            students = json.loads(res.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError):
        return None, None

    current_user_id = str(current_user.id)
    for student in students if isinstance(students, list) else []:
        student_id = str(student.get("id") or "")
        student_email = str(student.get("email") or "").strip().lower()
        if student_id != current_user_id and student_email != current_user.email.strip().lower():
            continue
        return (
            normalize_student_class_name(student.get("class_name") or student.get("class"), student.get("section")),
            student.get("roll_number"),
        )

    return None, None


def infer_student_context_from_local_data(db: Session, current_user: User) -> tuple[str | None, str | None]:
    if current_user.roll_number:
        match = db.query(User).filter(
            User.role == Role.student,
            User.roll_number == current_user.roll_number,
            User.id != current_user.id,
        ).first()
        if match:
            return match.class_name, match.roll_number

    match = db.query(User).filter(
        User.role == Role.student,
        User.email == current_user.email,
        User.id != current_user.id,
    ).first()
    if match and (match.class_name or match.roll_number):
        return match.class_name, match.roll_number

    shadow_matches = db.query(User).filter(
        User.role == Role.student,
        User.id != current_user.id,
        User.name == current_user.name,
    ).all()
    for match in shadow_matches:
        if match.roll_number or match.class_name:
            return match.class_name, match.roll_number

    return None, None


def ensure_student_context(db: Session, current_user: User, token: str | None = None) -> User:
    if current_user.role != Role.student:
        return current_user
    if current_user.class_name and current_user.roll_number:
        return current_user

    class_name, roll_number = (None, None)
    if token:
        class_name, roll_number = fetch_eduos_student_context(token, current_user)

    if not class_name and not roll_number:
        class_name, roll_number = infer_student_context_from_local_data(db, current_user)

    updated = False
    if class_name and not current_user.class_name:
        current_user.class_name = class_name
        updated = True
    if roll_number and not current_user.roll_number:
        current_user.roll_number = roll_number
        updated = True

    if updated:
        db.commit()
        db.refresh(current_user)

    return current_user


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    eduos_managed = is_eduos_managed_email(req.email)
    eduos_user = authenticate_with_eduos(req.email, req.password)
    if eduos_user:
        synced_user = sync_user_from_identity(
            db,
            email=req.email,
            password=req.password,
            name=eduos_user.get("full_name") or eduos_user.get("name"),
            role=eduos_user.get("role"),
            school_id=eduos_user.get("school_id"),
            class_name=normalize_student_class_name(
                eduos_user.get("class_name") or eduos_user.get("class"),
                eduos_user.get("section"),
            ),
            subject=eduos_user.get("subject"),
            roll_number=eduos_user.get("roll_number"),
            external_user_id=eduos_user.get("id"),
        )
        token = create_access_token({
            "sub": str(synced_user.id),
            "role": synced_user.role.value,
            "email": synced_user.email,
            "name": synced_user.name,
            "school_id": synced_user.school_id,
            "eduos_sub": eduos_user.get("id"),
        })
        return TokenResponse(
            access_token=token,
            user_id=str(synced_user.id),
            name=synced_user.name,
            role=synced_user.role.value,
            email=synced_user.email
        )

    # EduOS is configured but returned no match → wrong password on a managed school
    if eduos_managed and os.getenv("EDUOS_API_URL", "").rstrip("/"):
        raise HTTPException(status_code=401, detail="Invalid EduOS email or password")

    # EduOS not configured, or non-managed email → try local DB
    user = db.query(User).filter(User.email == req.email).first()
    if user and verify_password(req.password, user.password_hash):
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")
        return issue_token_response(user)

    raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/sso", response_model=TokenResponse)
def sso_login(req: SSORequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid SSO token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="SSO token missing email")

    user = sync_user_from_identity(
        db,
        email=email,
        password=None,
        name=payload.get("name"),
        role=payload.get("role"),
        school_id=payload.get("school_id"),
        external_user_id=payload.get("sub"),
    )
    user.subject = payload.get("subject") or user.subject
    user.class_name = normalize_student_class_name(
        payload.get("class_name") or user.class_name,
        payload.get("section"),
    ) or user.class_name
    user.roll_number = payload.get("roll_number") or user.roll_number
    db.commit()
    db.refresh(user)
    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "email": user.email,
        "name": user.name,
        "school_id": user.school_id,
        "eduos_sub": payload.get("sub"),
    })
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        name=user.name,
        role=user.role.value,
        email=user.email
    )


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    colors = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]
    import random
    user = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role=Role(req.role),
        school_id=req.school_id,
        subject=req.subject,
        class_name=req.class_name,
        roll_number=req.roll_number,
        avatar_color=random.choice(colors)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Account created", "user_id": str(user.id)}


@router.get("/me")
def me(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    current_user = ensure_student_context(db, current_user, token)
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role.value,
        "school_id": current_user.school_id,
        "subject": current_user.subject,
        "class_name": current_user.class_name,
        "roll_number": current_user.roll_number,
        "avatar_color": current_user.avatar_color,
    }


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        return {"message": "If that email is registered, a reset token has been generated."}

    reset_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "type": "password_reset"},
        expires_delta=timedelta(hours=1),
    )
    return {
        "message": "Password reset token generated. Use it within 1 hour.",
        "reset_token": reset_token,
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password reset successfully. You can now log in with your new password."}

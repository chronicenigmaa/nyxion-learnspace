import json
import os
from urllib import error, request as urllib_request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from app.db.database import get_db
from app.models.models import User, Role
from app.core.security import verify_password, hash_password, create_access_token, get_current_user, SECRET_KEY, ALGORITHM

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


def is_eduos_managed_email(email: str | None) -> bool:
    return bool(email and email.strip().lower().endswith("@alnooracademy.com"))


def normalize_role(role: str | None) -> Role:
    if role in (Role.student.value, Role.teacher.value, Role.school_admin.value, Role.super_admin.value):
        return Role(role)
    if role == "admin":
        return Role.school_admin
    return Role.student


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
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, password_hash=hash_password(password or email))
        db.add(user)

    user.name = name or user.name or email.split("@")[0].replace(".", " ").title()
    if password:
        user.password_hash = hash_password(password)
    user.role = normalize_role(role)
    user.school_id = school_id or user.school_id
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

    if eduos_managed:
        if not os.getenv("EDUOS_API_URL", "").rstrip("/"):
            raise HTTPException(status_code=503, detail="EduOS login is not configured")
        raise HTTPException(status_code=401, detail="Invalid EduOS email or password")

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
    )
    user.subject = payload.get("subject") or user.subject
    user.class_name = payload.get("class_name") or user.class_name
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
def me(current_user: User = Depends(get_current_user)):
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

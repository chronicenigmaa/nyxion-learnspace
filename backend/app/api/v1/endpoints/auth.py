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


def normalize_role(role: str | None) -> Role:
    if role in (Role.student.value, Role.teacher.value, Role.school_admin.value, Role.super_admin.value):
        return Role(role)
    if role == "admin":
        return Role.school_admin
    return Role.student


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        name=user.name,
        role=user.role.value,
        email=user.email
    )


@router.post("/sso", response_model=TokenResponse)
def sso_login(req: SSORequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid SSO token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="SSO token missing email")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, password_hash=hash_password(email))
        db.add(user)

    user.name = payload.get("name") or user.name or email.split("@")[0].replace(".", " ").title()
    user.role = normalize_role(payload.get("role"))
    user.school_id = payload.get("school_id") or user.school_id
    user.subject = payload.get("subject") or user.subject
    user.class_name = payload.get("class_name") or user.class_name
    user.roll_number = payload.get("roll_number") or user.roll_number
    user.avatar_color = user.avatar_color or "#6366f1"
    user.is_active = True

    db.commit()
    db.refresh(user)

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "email": user.email,
        "name": user.name,
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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.db.database import get_db
from app.models.models import User, Role
from app.core.security import verify_password, hash_password, create_access_token, get_current_user

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


@router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    """Creates demo accounts for testing"""
    demo_users = [
        {"name": "Ms. Fatima Malik", "email": "teacher@demo.com", "password": "demo123", "role": "teacher", "subject": "Mathematics"},
        {"name": "Ahmed Khan", "email": "student@demo.com", "password": "demo123", "role": "student", "class_name": "Class 9A", "roll_number": "09A-001"},
        {"name": "Admin User", "email": "admin@demo.com", "password": "demo123", "role": "school_admin"},
    ]
    created = []
    for u in demo_users:
        if not db.query(User).filter(User.email == u["email"]).first():
            user = User(
                name=u["name"], email=u["email"],
                password_hash=hash_password(u["password"]),
                role=Role(u["role"]),
                subject=u.get("subject"),
                class_name=u.get("class_name"),
                roll_number=u.get("roll_number"),
            )
            db.add(user)
            created.append(u["email"])
    db.commit()
    return {"created": created, "message": "Demo accounts ready"}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, Role, Submission, Assignment
from app.core.security import get_current_user

router = APIRouter()


@router.get("/students")
def list_students(class_name: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    query = db.query(User).filter(User.role == Role.student)
    if class_name:
        query = query.filter(User.class_name == class_name)
    students = query.all()
    return [{"id": str(s.id), "name": s.name, "email": s.email, "class_name": s.class_name, "roll_number": s.roll_number} for s in students]


@router.get("/teachers")
def list_teachers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    teachers = db.query(User).filter(User.role == Role.teacher).all()
    return [{"id": str(t.id), "name": t.name, "email": t.email, "subject": t.subject} for t in teachers]

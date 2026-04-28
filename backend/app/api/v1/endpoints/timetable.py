from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from app.db.database import get_db
from app.models.models import Timetable, User, Role
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

class TimetableCreate(BaseModel):
    day: str
    period: str
    subject: str
    teacher_name: Optional[str] = None
    class_name: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None

@router.get("/")
def get_timetable(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Timetable)
    if current_user.school_id:
        q = q.filter(Timetable.school_id == current_user.school_id)
    if current_user.role == Role.student and current_user.class_name:
        q = q.filter(Timetable.class_name == current_user.class_name)
    return q.order_by(Timetable.day, Timetable.period).all()

@router.post("/")
def create_timetable_entry(
    data: TimetableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(403, "Teachers only")
    entry = Timetable(
        **data.model_dump(),
        school_id=current_user.school_id,
        created_by=current_user.id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_timetable_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(403, "Teachers only")
    entry = db.query(Timetable).filter(Timetable.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
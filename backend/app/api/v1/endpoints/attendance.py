import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.models import Attendance, User, Role
from app.core.security import get_current_user, hash_password

router = APIRouter()


def resolve_student_identity_ids(db: Session, current_user: User) -> list:
    user_ids = {current_user.id}

    if current_user.roll_number:
        matches = db.query(User.id).filter(
            User.role == Role.student,
            User.roll_number == current_user.roll_number,
        ).all()
        user_ids.update(match[0] for match in matches)

    elif current_user.class_name and current_user.name:
        matches = db.query(User.id).filter(
            User.role == Role.student,
            User.class_name == current_user.class_name,
            User.name == current_user.name,
        ).all()
        user_ids.update(match[0] for match in matches)

    return list(user_ids)


class AttendanceRecord(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    class_name: Optional[str] = None
    roll_number: Optional[str] = None
    is_present: bool


class BulkAttendanceRequest(BaseModel):
    class_name: str
    subject: Optional[str] = None
    date: str  # YYYY-MM-DD
    records: List[AttendanceRecord]


@router.post("/bulk")
def mark_bulk_attendance(req: BulkAttendanceRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")

    for record in req.records:
        try:
            student_uuid = uuid.UUID(record.student_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid student id")

        student = db.query(User).filter(User.id == student_uuid).first()
        if not student:
            shadow_email = f"eduos-student-{student_uuid}@learnspace.local"
            student = User(
                id=student_uuid,
                name=record.student_name or f"Student {record.student_id[:8]}",
                email=shadow_email,
                password_hash=hash_password(str(student_uuid)),
                role=Role.student,
                school_id=current_user.school_id,
                class_name=record.class_name or req.class_name,
                roll_number=record.roll_number,
                avatar_color="#10b981",
                is_active=True,
            )
            db.add(student)
            db.flush()
        else:
            if record.student_name:
                student.name = record.student_name
            if record.class_name:
                student.class_name = record.class_name
            if record.roll_number:
                student.roll_number = record.roll_number

        existing = db.query(Attendance).filter(
            Attendance.student_id == student_uuid,
            Attendance.date == req.date,
            Attendance.class_name == req.class_name
        ).first()
        if existing:
            existing.is_present = record.is_present
        else:
            att = Attendance(
                student_id=student_uuid,
                class_name=req.class_name,
                subject=req.subject,
                date=req.date,
                is_present=record.is_present,
                marked_by=current_user.id
            )
            db.add(att)
    db.commit()
    return {"message": f"Attendance marked for {len(req.records)} students"}


@router.get("/class/{class_name}")
def get_class_attendance(class_name: str, start_date: Optional[str] = None, end_date: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Attendance).filter(Attendance.class_name == class_name)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)
    records = query.all()

    # Group by student
    student_map = {}
    for r in records:
        sid = str(r.student_id)
        if sid not in student_map:
            student_map[sid] = {"student_id": sid, "student_name": r.student.name if r.student else "Unknown", "present": 0, "absent": 0, "records": []}
        if r.is_present:
            student_map[sid]["present"] += 1
        else:
            student_map[sid]["absent"] += 1
        student_map[sid]["records"].append({"date": r.date, "is_present": r.is_present})

    for v in student_map.values():
        total = v["present"] + v["absent"]
        v["percentage"] = round(v["present"] / total * 100, 1) if total > 0 else 0

    return list(student_map.values())


@router.get("/my")
def get_my_attendance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student_ids = resolve_student_identity_ids(db, current_user)
    records = db.query(Attendance).filter(Attendance.student_id.in_(student_ids)).all()
    present = sum(1 for r in records if r.is_present)
    total = len(records)
    return {
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": round(present / total * 100, 1) if total > 0 else 0,
        "records": [{"date": r.date, "is_present": r.is_present, "subject": r.subject} for r in records]
    }

import uuid
import os
import shutil
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Assignment, User, Role, AssignmentStatus
from app.core.security import get_current_user

router = APIRouter()

UPLOAD_DIR = "/uploads/assignments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class AssignmentCreate(BaseModel):
    title: str
    description: str = ""
    subject: str
    class_name: str
    due_date: str  # ISO datetime string
    max_marks: float = 100
    allow_late: bool = False
    status: str = "published"


def serialize_assignment(a: Assignment, include_teacher: bool = True):
    return {
        "id": str(a.id),
        "title": a.title,
        "description": a.description,
        "subject": a.subject,
        "class_name": a.class_name,
        "teacher_id": str(a.teacher_id),
        "teacher_name": a.teacher.name if a.teacher else None,
        "due_date": a.due_date.isoformat() if a.due_date else None,
        "max_marks": a.max_marks,
        "status": a.status.value,
        "allow_late": a.allow_late,
        "attachments": a.attachments or [],
        "created_at": a.created_at.isoformat(),
        "submission_count": len(a.submissions) if a.submissions else 0,
    }


@router.get("/")
def list_assignments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == Role.teacher:
        assignments = db.query(Assignment).filter(Assignment.teacher_id == current_user.id).all()
    elif current_user.role == Role.student:
        assignments = db.query(Assignment).filter(
            Assignment.class_name == current_user.class_name,
            Assignment.status == AssignmentStatus.published
        ).all()
    else:
        assignments = db.query(Assignment).all()
    return [serialize_assignment(a) for a in assignments]


@router.get("/{assignment_id}")
def get_assignment(assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return serialize_assignment(a)


@router.post("/")
def create_assignment(
    title: str = Form(...),
    description: str = Form(""),
    subject: str = Form(...),
    class_name: str = Form(...),
    due_date: str = Form(...),
    max_marks: float = Form(100),
    allow_late: bool = Form(False),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Only teachers can create assignments")

    try:
        parsed_due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid due date format")

    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            filename = f"{file_id}_{file.filename}"
            path = os.path.join(UPLOAD_DIR, filename)
            with open(path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append({"name": file.filename, "path": f"/uploads/assignments/{filename}", "id": file_id})

    assignment = Assignment(
        title=title,
        description=description,
        subject=subject,
        class_name=class_name,
        teacher_id=current_user.id,
        due_date=parsed_due_date,
        max_marks=max_marks,
        allow_late=allow_late,
        attachments=saved_files,
        status=AssignmentStatus.published
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return serialize_assignment(assignment)


@router.put("/{assignment_id}")
def update_assignment(
    assignment_id: uuid.UUID,
    title: str = Form(...),
    description: str = Form(""),
    subject: str = Form(...),
    class_name: str = Form(...),
    due_date: str = Form(...),
    max_marks: float = Form(100),
    allow_late: bool = Form(False),
    remove_attachment_ids: str = Form(""),  # comma-separated attachment IDs to remove
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.teacher_id == current_user.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found or not authorized")

    try:
        parsed_due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid due date format")

    a.title = title
    a.description = description
    a.subject = subject
    a.class_name = class_name
    a.due_date = parsed_due_date
    a.max_marks = max_marks
    a.allow_late = allow_late

    ids_to_remove = set(x.strip() for x in remove_attachment_ids.split(",") if x.strip())
    kept = [att for att in (a.attachments or []) if att.get("id") not in ids_to_remove]

    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            filename = f"{file_id}_{file.filename}"
            path = os.path.join(UPLOAD_DIR, filename)
            with open(path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            kept.append({"name": file.filename, "path": f"/uploads/assignments/{filename}", "id": file_id})

    a.attachments = kept
    db.commit()
    db.refresh(a)
    return serialize_assignment(a)


@router.patch("/{assignment_id}/status")
def update_status(assignment_id: uuid.UUID, status: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.teacher_id == current_user.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.status = AssignmentStatus(status)
    db.commit()
    return {"message": f"Status updated to {status}"}


@router.delete("/{assignment_id}")
def delete_assignment(assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.teacher_id == current_user.id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found or not authorized")
    db.delete(a)
    db.commit()
    return {"message": "Deleted"}

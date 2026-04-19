import uuid
import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Note, User, Role
from app.core.security import get_current_user
from fastapi.responses import FileResponse

router = APIRouter()

UPLOAD_DIR = "/uploads/notes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def serialize_note(n: Note):
    return {
        "id": str(n.id),
        "title": n.title,
        "description": n.description,
        "subject": n.subject,
        "class_name": n.class_name,
        "teacher_id": str(n.teacher_id),
        "teacher_name": n.teacher.name if n.teacher else None,
        "files": n.files or [],
        "created_at": n.created_at.isoformat(),
    }


@router.get("/")
def list_notes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == Role.teacher:
        notes = db.query(Note).filter(Note.teacher_id == current_user.id).all()
    elif current_user.role == Role.student:
        notes = db.query(Note).filter(Note.class_name == current_user.class_name).all()
    else:
        notes = db.query(Note).all()
    return [serialize_note(n) for n in notes]


@router.post("/")
def upload_notes(
    title: str = Form(...),
    description: str = Form(""),
    subject: str = Form(...),
    class_name: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")

    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            filename = f"{file_id}_{file.filename}"
            path = os.path.join(UPLOAD_DIR, filename)
            with open(path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append({
                "name": file.filename,
                "path": f"/uploads/notes/{filename}",
                "id": file_id,
                "size": os.path.getsize(path)
            })

    note = Note(
        title=title,
        description=description,
        subject=subject,
        class_name=class_name,
        teacher_id=current_user.id,
        files=saved_files
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return serialize_note(note)


@router.delete("/{note_id}")
def delete_note(note_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    note = db.query(Note).filter(Note.id == note_id, Note.teacher_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(note)
    db.commit()
    return {"message": "Deleted"}

import uuid
import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Note, User, Role
from app.core.security import get_current_user

router = APIRouter()

UPLOAD_DIR = "/uploads/notes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def normalize_name(value: str | None) -> str:
    return "".join(str(value or "").lower().split())


def resolve_student_class_name(db: Session, current_user: User) -> str | None:
    if current_user.class_name:
        return current_user.class_name

    candidate_query = db.query(User).filter(
        User.role == Role.student,
        User.id != current_user.id,
    )
    if current_user.school_id:
        candidate_query = candidate_query.filter(User.school_id == current_user.school_id)
    candidates = candidate_query.all()

    if current_user.roll_number:
        for candidate in candidates:
            if candidate.roll_number == current_user.roll_number and candidate.class_name:
                return candidate.class_name

    current_name = normalize_name(current_user.name)
    if current_name:
        for candidate in candidates:
            if normalize_name(candidate.name) == current_name and candidate.class_name:
                return candidate.class_name

    email_match = db.query(User).filter(
        User.role == Role.student,
        User.email == current_user.email,
        User.id != current_user.id,
    ).first()
    if email_match and email_match.class_name:
        return email_match.class_name

    return None


def build_class_aliases(class_name: str | None) -> set[str]:
    raw = str(class_name or "").strip()
    if not raw:
        return set()

    aliases = {raw}
    compact = raw.lower().replace("class", "").replace(" ", "").replace("-", "")
    if not compact:
        return aliases

    suffix = compact[-1].upper() if compact[-1].isalpha() else ""
    base = compact[:-1] if suffix else compact
    aliases.add(compact.upper())
    aliases.add(f"Class {compact.upper()}")
    if base.isdigit():
        aliases.add(base)
        aliases.add(f"Class {base}")
        if suffix:
            aliases.add(f"{base}{suffix}")
            aliases.add(f"Class {base}{suffix}")
    return aliases


def serialize_note(n: Note):
    files = []
    for file in (n.files or []):
        files.append({
            **file,
            "download_url": f"/api/v1/notes/{n.id}/files/{file.get('id')}/download" if file.get("id") else None,
        })
    return {
        "id": str(n.id),
        "title": n.title,
        "description": n.description,
        "subject": n.subject,
        "class_name": n.class_name,
        "teacher_id": str(n.teacher_id),
        "teacher_name": n.teacher.name if n.teacher else None,
        "files": files,
        "created_at": n.created_at.isoformat(),
    }


@router.get("/")
def list_notes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == Role.teacher:
        notes = db.query(Note).filter(Note.teacher_id == current_user.id).all()
    elif current_user.role == Role.student:
        class_name = resolve_student_class_name(db, current_user)
        if class_name and not current_user.class_name:
            current_user.class_name = class_name
            db.commit()
            db.refresh(current_user)
        aliases = build_class_aliases(class_name)
        if not aliases:
            return []
        notes = db.query(Note).filter(Note.class_name.in_(aliases)).all()
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


@router.get("/{note_id}/files/{file_id}/download")
def download_note_file(
    note_id: uuid.UUID,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if current_user.role == Role.teacher and note.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if current_user.role == Role.student:
        class_name = resolve_student_class_name(db, current_user)
        if note.class_name not in build_class_aliases(class_name):
            raise HTTPException(status_code=403, detail="Not allowed")

    note_file = next((f for f in (note.files or []) if f.get("id") == file_id), None)
    if not note_file:
        raise HTTPException(status_code=404, detail="File not found")

    stored_path = str(note_file.get("path") or "").strip()
    filename = os.path.basename(stored_path)
    if not filename:
        raise HTTPException(status_code=404, detail="File not found")

    absolute_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(absolute_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        absolute_path,
        filename=note_file.get("name") or filename,
        media_type="application/octet-stream",
    )

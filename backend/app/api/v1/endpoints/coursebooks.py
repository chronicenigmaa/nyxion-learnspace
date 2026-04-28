from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import uuid, os, shutil

from app.db.database import get_db
from app.models.models import Coursebook, User, Role
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

UPLOAD_DIR = "/uploads/coursebooks"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/")
def get_coursebooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Coursebook)
    if current_user.school_id:
        q = q.filter(Coursebook.school_id == current_user.school_id)
    if current_user.role == Role.student and current_user.class_name:
        q = q.filter(Coursebook.class_name == current_user.class_name)
    return q.order_by(Coursebook.created_at.desc()).all()

@router.post("/")
async def create_coursebook(
    title: str = Form(...),
    subject: str = Form(...),
    class_name: str = Form(...),
    description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(403, "Teachers only")

    file_path = None
    file_name = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1]
        fname = f"{uuid.uuid4()}{ext}"
        dest = os.path.join(UPLOAD_DIR, fname)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        file_path = f"/uploads/coursebooks/{fname}"
        file_name = file.filename

    book = Coursebook(
        title=title,
        subject=subject,
        class_name=class_name,
        description=description,
        file_path=file_path,
        file_name=file_name,
        uploaded_by=current_user.name,
        school_id=current_user.school_id,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book

@router.delete("/{book_id}")
def delete_coursebook(
    book_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(403, "Teachers only")
    book = db.query(Coursebook).filter(Coursebook.id == book_id).first()
    if not book:
        raise HTTPException(404, "Not found")
    if book.file_path:
        try:
            os.remove(book.file_path)
        except Exception:
            pass
    db.delete(book)
    db.commit()
    return {"ok": True}
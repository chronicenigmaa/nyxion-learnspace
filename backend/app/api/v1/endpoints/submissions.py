import uuid
import os
import shutil
import hashlib
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.models.models import Submission, Assignment, User, Role, SubmissionStatus
from app.core.security import get_current_user

router = APIRouter()

UPLOAD_DIR = "/uploads/submissions"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def check_plagiarism(content: str, all_submissions: list) -> dict:
    """Simple plagiarism checker using text similarity"""
    if not content or len(content) < 50:
        return {"score": 0, "matches": []}

    def similarity(a, b):
        if not a or not b:
            return 0
        a_words = set(a.lower().split())
        b_words = set(b.lower().split())
        if not a_words or not b_words:
            return 0
        return len(a_words & b_words) / len(a_words | b_words)

    matches = []
    max_score = 0
    for sub in all_submissions:
        if sub.content:
            score = similarity(content, sub.content)
            if score > 0.4:  # 40% similarity threshold
                matches.append({
                    "student_id": str(sub.student_id),
                    "similarity": round(score * 100, 1)
                })
                max_score = max(max_score, score)

    return {
        "score": round(max_score * 100, 1),
        "matches": matches,
        "flagged": max_score > 0.6
    }


def serialize_submission(s: Submission):
    return {
        "id": str(s.id),
        "assignment_id": str(s.assignment_id),
        "student_id": str(s.student_id),
        "student_name": s.student.name if s.student else None,
        "content": s.content,
        "files": s.files or [],
        "status": s.status.value,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "marks_obtained": s.marks_obtained,
        "feedback": s.feedback,
        "plagiarism_score": s.plagiarism_score,
        "plagiarism_report": s.plagiarism_report,
        "graded_at": s.graded_at.isoformat() if s.graded_at else None,
    }


@router.get("/assignment/{assignment_id}")
def get_submissions_for_assignment(assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")
    subs = db.query(Submission).filter(Submission.assignment_id == assignment_id).all()
    return [serialize_submission(s) for s in subs]


@router.get("/my/{assignment_id}")
def get_my_submission(assignment_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id
    ).first()
    if not sub:
        return None
    return serialize_submission(sub)


@router.post("/submit")
def submit_assignment(
    assignment_id: str = Form(...),
    content: str = Form(""),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != Role.student:
        raise HTTPException(status_code=403, detail="Students only")

    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    now = datetime.utcnow()
    is_late = now > assignment.due_date
    if is_late and not assignment.allow_late:
        raise HTTPException(status_code=400, detail="Submission deadline has passed")

    # Check for existing submission
    existing = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id
    ).first()

    # Save files
    saved_files = []
    for file in files:
        if file.filename:
            file_id = str(uuid.uuid4())
            filename = f"{file_id}_{file.filename}"
            path = os.path.join(UPLOAD_DIR, filename)
            with open(path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append({"name": file.filename, "path": f"/uploads/submissions/{filename}", "id": file_id})

    # Run plagiarism check
    other_subs = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id != current_user.id
    ).all()
    plagiarism = check_plagiarism(content, other_subs)

    if existing:
        existing.content = content
        existing.files = saved_files
        existing.status = SubmissionStatus.late if is_late else SubmissionStatus.submitted
        existing.submitted_at = now
        existing.plagiarism_score = plagiarism["score"]
        existing.plagiarism_report = plagiarism
        db.commit()
        return serialize_submission(existing)
    else:
        sub = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
            content=content,
            files=saved_files,
            status=SubmissionStatus.late if is_late else SubmissionStatus.submitted,
            submitted_at=now,
            plagiarism_score=plagiarism["score"],
            plagiarism_report=plagiarism
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return serialize_submission(sub)


@router.post("/{submission_id}/grade")
def grade_submission(
    submission_id: uuid.UUID,
    marks: float = Form(...),
    feedback: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [Role.teacher, Role.school_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")

    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = db.query(Assignment).filter(Assignment.id == sub.assignment_id).first()
    if marks > assignment.max_marks:
        raise HTTPException(status_code=400, detail=f"Marks cannot exceed {assignment.max_marks}")

    sub.marks_obtained = marks
    sub.feedback = feedback
    sub.status = SubmissionStatus.graded
    sub.graded_at = datetime.utcnow()
    sub.graded_by = current_user.id
    db.commit()
    return serialize_submission(sub)

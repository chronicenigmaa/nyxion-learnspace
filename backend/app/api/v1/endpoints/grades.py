from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Submission, User, Role, SubmissionStatus
from app.core.security import get_current_user

router = APIRouter()


@router.get("/student/{student_id}")
def get_student_grades(student_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subs = db.query(Submission).filter(
        Submission.student_id == student_id,
        Submission.status == SubmissionStatus.graded
    ).all()
    grades = []
    for s in subs:
        if s.assignment:
            grades.append({
                "assignment_id": str(s.assignment_id),
                "assignment_title": s.assignment.title,
                "subject": s.assignment.subject,
                "marks_obtained": s.marks_obtained,
                "max_marks": s.assignment.max_marks,
                "percentage": round(s.marks_obtained / s.assignment.max_marks * 100, 1) if s.assignment.max_marks else 0,
                "feedback": s.feedback,
                "graded_at": s.graded_at.isoformat() if s.graded_at else None
            })
    return grades


@router.get("/my")
def get_my_grades(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_student_grades(str(current_user.id), db, current_user)

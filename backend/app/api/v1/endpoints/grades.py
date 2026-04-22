from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Submission, User, Role, SubmissionStatus
from app.core.security import get_current_user

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
    student_ids = resolve_student_identity_ids(db, current_user)
    subs = db.query(Submission).filter(
        Submission.student_id.in_(student_ids),
        Submission.status == SubmissionStatus.graded,
    ).all()
    grades = []
    seen_assignment_ids = set()
    for s in subs:
        if not s.assignment:
            continue
        assignment_id = str(s.assignment_id)
        if assignment_id in seen_assignment_ids:
            continue
        seen_assignment_ids.add(assignment_id)
        grades.append({
            "assignment_id": assignment_id,
            "assignment_title": s.assignment.title,
            "subject": s.assignment.subject,
            "marks_obtained": s.marks_obtained,
            "max_marks": s.assignment.max_marks,
            "percentage": round(s.marks_obtained / s.assignment.max_marks * 100, 1) if s.assignment.max_marks else 0,
            "feedback": s.feedback,
            "graded_at": s.graded_at.isoformat() if s.graded_at else None
        })
    return grades

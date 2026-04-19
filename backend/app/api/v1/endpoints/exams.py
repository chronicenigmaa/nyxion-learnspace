import uuid
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from app.db.database import get_db
from app.models.models import Exam, ExamAttempt, User, Role, ExamStatus
from app.core.security import get_current_user

router = APIRouter()


class QuestionCreate(BaseModel):
    id: str
    type: str  # mcq, short, long
    question: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None  # for MCQ
    marks: float = 5


class ExamCreate(BaseModel):
    title: str
    subject: str
    class_name: str
    duration_minutes: int = 60
    total_marks: float = 100
    scheduled_at: str
    questions: List[QuestionCreate]
    restrict_tab_switch: bool = True
    restrict_copy_paste: bool = True
    restrict_right_click: bool = True
    fullscreen_required: bool = True
    max_tab_warnings: int = 3
    shuffle_questions: bool = True


class ViolationLog(BaseModel):
    type: str  # tab_switch, fullscreen_exit, copy_paste
    timestamp: str
    details: str = ""


def serialize_exam(e: Exam, include_answers: bool = False):
    questions = e.questions or []
    if not include_answers:
        questions = [{k: v for k, v in q.items() if k != "correct_answer"} for q in questions]
    return {
        "id": str(e.id),
        "title": e.title,
        "subject": e.subject,
        "class_name": e.class_name,
        "teacher_id": str(e.teacher_id),
        "duration_minutes": e.duration_minutes,
        "total_marks": e.total_marks,
        "scheduled_at": e.scheduled_at.isoformat() if e.scheduled_at else None,
        "status": e.status.value,
        "questions": questions,
        "question_count": len(questions),
        "restrict_tab_switch": e.restrict_tab_switch,
        "restrict_copy_paste": e.restrict_copy_paste,
        "restrict_right_click": e.restrict_right_click,
        "fullscreen_required": e.fullscreen_required,
        "max_tab_warnings": e.max_tab_warnings,
        "shuffle_questions": e.shuffle_questions,
    }


@router.get("/")
def list_exams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == Role.teacher:
        exams = db.query(Exam).filter(Exam.teacher_id == current_user.id).all()
    elif current_user.role == Role.student:
        exams = db.query(Exam).filter(
            Exam.class_name == current_user.class_name,
            Exam.status.in_([ExamStatus.scheduled, ExamStatus.live])
        ).all()
    else:
        exams = db.query(Exam).all()
    return [serialize_exam(e) for e in exams]


@router.post("/")
def create_exam(req: ExamCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")

    exam = Exam(
        title=req.title,
        subject=req.subject,
        class_name=req.class_name,
        teacher_id=current_user.id,
        duration_minutes=req.duration_minutes,
        total_marks=req.total_marks,
        scheduled_at=datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00")),
        questions=[q.dict() for q in req.questions],
        restrict_tab_switch=req.restrict_tab_switch,
        restrict_copy_paste=req.restrict_copy_paste,
        restrict_right_click=req.restrict_right_click,
        fullscreen_required=req.fullscreen_required,
        max_tab_warnings=req.max_tab_warnings,
        shuffle_questions=req.shuffle_questions,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return serialize_exam(exam, include_answers=True)


@router.patch("/{exam_id}/start")
def start_exam(exam_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.status = ExamStatus.live
    db.commit()
    return {"message": "Exam is now live"}


@router.patch("/{exam_id}/end")
def end_exam(exam_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.teacher_id == current_user.id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.status = ExamStatus.ended
    db.commit()
    return {"message": "Exam ended"}


@router.post("/{exam_id}/attempt/start")
def start_attempt(exam_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != Role.student:
        raise HTTPException(status_code=403, detail="Students only")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.status != ExamStatus.live:
        raise HTTPException(status_code=400, detail="Exam is not live yet")

    existing = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if existing:
        if existing.is_terminated:
            raise HTTPException(status_code=403, detail="Your exam was terminated due to violations")
        return {"attempt_id": str(existing.id), "message": "Resuming existing attempt"}

    attempt = ExamAttempt(
        exam_id=exam_id,
        student_id=current_user.id,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return {"attempt_id": str(attempt.id), "message": "Attempt started"}


@router.post("/{exam_id}/attempt/violation")
def log_violation(exam_id: uuid.UUID, violation: ViolationLog, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    violations = attempt.violations or []
    violations.append(violation.dict())
    attempt.violations = violations

    if violation.type == "tab_switch":
        attempt.tab_switch_count += 1
        if attempt.tab_switch_count >= exam.max_tab_warnings:
            attempt.is_terminated = True
            attempt.termination_reason = f"Too many tab switches ({attempt.tab_switch_count})"

    db.commit()
    return {
        "tab_switch_count": attempt.tab_switch_count,
        "terminated": attempt.is_terminated,
        "warnings_remaining": max(0, exam.max_tab_warnings - attempt.tab_switch_count)
    }


@router.post("/{exam_id}/attempt/submit")
def submit_exam(exam_id: uuid.UUID, answers: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(ExamAttempt).filter(
        ExamAttempt.exam_id == exam_id,
        ExamAttempt.student_id == current_user.id
    ).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.is_terminated:
        raise HTTPException(status_code=403, detail="Exam was terminated")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()

    # Auto-grade MCQ questions
    auto_score = 0
    for q in (exam.questions or []):
        if q.get("type") == "mcq" and q.get("correct_answer"):
            student_answer = answers.get(q["id"], "")
            if student_answer == q["correct_answer"]:
                auto_score += q.get("marks", 0)

    attempt.answers = answers
    attempt.submitted_at = datetime.utcnow()
    attempt.score = auto_score
    db.commit()
    return {"message": "Exam submitted", "auto_score": auto_score}


@router.get("/{exam_id}/results")
def get_exam_results(exam_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.teacher, Role.school_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")
    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all()
    return [{
        "student_id": str(a.student_id),
        "student_name": a.student.name if a.student else "Unknown",
        "score": a.score,
        "tab_switches": a.tab_switch_count,
        "violations": len(a.violations or []),
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "terminated": a.is_terminated,
    } for a in attempts]

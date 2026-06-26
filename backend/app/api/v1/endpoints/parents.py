"""
Parent portal endpoints.

PRODUCT:  LearnSpace
PATH:     app/api/v1/endpoints/parents.py   (NEW FILE)

Provides:
  - Admin endpoints to create parent accounts and link them to children.
  - Parent endpoints to read a linked child's overview (grades, attendance,
    assignments, upcoming exams) and fees (proxied from EduOS).

SECURITY MODEL:
  A parent may ONLY read data for a student that is explicitly linked to
  them in the parent_children table. We never match parents to children by
  name / roll number / email (that logic exists elsewhere for students
  reconciling their own scattered records, but it is unsafe for parents
  because a name collision would expose another family's child).
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from urllib import error, request as urllib_request

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import jwt

from app.db.database import get_db
from app.models.models import (
    User, Role, ParentChild,
    Submission, Assignment, Attendance, Exam,
    SubmissionStatus, AssignmentStatus,
)
from app.core.security import (
    get_current_user, hash_password, oauth2_scheme,
    decode_access_token, SECRET_KEY, ALGORITHM,
)
from app.core.logging_client import log_event

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────
class CreateParentRequest(BaseModel):
    name: str
    email: str
    password: str
    child_ids: list[str] = []


class LinkRequest(BaseModel):
    parent_id: str
    student_id: str


# ── Authorization helpers ──────────────────────────────────────────────────
def _admin_only(user: User):
    if user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Admins only")


def get_linked_child(db: Session, parent: User, student_id: str) -> User:
    """Return the student IFF it is explicitly linked to this parent."""
    if parent.role != Role.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    try:
        sid = uuid.UUID(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student id")

    link = db.query(ParentChild).filter_by(parent_id=parent.id, student_id=sid).first()
    if not link:
        raise HTTPException(status_code=403, detail="Not your child")

    child = db.query(User).filter(User.id == sid).first()
    if not child:
        raise HTTPException(status_code=404, detail="Student not found")
    return child


def list_children(db: Session, parent: User) -> list[User]:
    links = db.query(ParentChild).filter_by(parent_id=parent.id).all()
    ids = [l.student_id for l in links]
    if not ids:
        return []
    return db.query(User).filter(User.id.in_(ids)).all()


# ── EduOS fee bridge (self-contained) ──────────────────────────────────────
def _eduos_fee_payload(token: str):
    """
    Fetch raw fee data from EduOS's /api/v1/fees/defaulter-input.

    Two modes, chosen by env var:

      SERVICE-ACCOUNT MODE  (set EDUOS_SERVICE_TOKEN)
        LearnSpace uses one long-lived EduOS token to read fees and filters
        by roll number itself. Use this when parent accounts have NO EduOS
        identity (the common case). Operationally simplest.

      BRIDGE MODE  (no EDUOS_SERVICE_TOKEN)
        Mints a short-lived EduOS token from the parent's own token using
        the shared SECRET_KEY, requires the parent token to carry an
        'eduos_sub' claim. Use this only if parents have EduOS identities.

    Returns parsed JSON ({"students": [...]}) or None if unavailable.
    """
    base = os.getenv("EDUOS_API_URL", "").rstrip("/")
    if not base:
        return None

    service_token = os.getenv("EDUOS_SERVICE_TOKEN", "")
    if service_token:
        eduos_token = service_token
    else:
        try:
            payload = decode_access_token(token)
        except Exception:
            return None
        eduos_sub = payload.get("eduos_sub")
        if not eduos_sub:
            return None
        eduos_token = jwt.encode(
            {
                "sub": eduos_sub,
                "school_id": payload.get("school_id"),
                "role": payload.get("role"),
                "exp": datetime.utcnow() + timedelta(minutes=10),
            },
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

    req = urllib_request.Request(
        f"{base}/api/v1/fees/defaulter-input",
        headers={"Authorization": f"Bearer {eduos_token}"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError):
        return None


# ── Admin: create / link / unlink ──────────────────────────────────────────
@router.post("/")
def create_parent(
    req: CreateParentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _admin_only(current_user)
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    parent = User(
        name=req.name,
        email=req.email,
        password_hash=hash_password(req.password),
        role=Role.parent,
        school_id=current_user.school_id,
        is_active=True,
    )
    db.add(parent)
    db.flush()  # get parent.id before linking

    linked = []
    for sid in req.child_ids:
        try:
            student_uuid = uuid.UUID(sid)
        except ValueError:
            continue
        student = db.query(User).filter(
            User.id == student_uuid, User.role == Role.student
        ).first()
        if student:
            db.add(ParentChild(parent_id=parent.id, student_id=student.id))
            linked.append(sid)

    db.commit()
    db.refresh(parent)
    log_event(
        "info", "parent.created",
        user_id=str(current_user.id), role=current_user.role.value,
        detail_parent=str(parent.id), detail_children=linked,
    )
    return {"id": str(parent.id), "name": parent.name, "email": parent.email,
            "linked_children": linked}


@router.post("/link")
def link_child(
    req: LinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _admin_only(current_user)
    try:
        pid, sid = uuid.UUID(req.parent_id), uuid.UUID(req.student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")

    if db.query(ParentChild).filter_by(parent_id=pid, student_id=sid).first():
        return {"message": "Already linked"}

    db.add(ParentChild(parent_id=pid, student_id=sid))
    db.commit()
    log_event("info", "parent.linked", user_id=str(current_user.id),
              role=current_user.role.value,
              detail_parent=req.parent_id, detail_child=req.student_id)
    return {"message": "Linked"}


@router.delete("/link")
def unlink_child(
    req: LinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _admin_only(current_user)
    try:
        pid, sid = uuid.UUID(req.parent_id), uuid.UUID(req.student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")

    db.query(ParentChild).filter_by(parent_id=pid, student_id=sid).delete()
    db.commit()
    log_event("info", "parent.unlinked", user_id=str(current_user.id),
              role=current_user.role.value,
              detail_parent=req.parent_id, detail_child=req.student_id)
    return {"message": "Unlinked"}


# ── Parent: list my children ───────────────────────────────────────────────
@router.get("/children")
def my_children(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != Role.parent:
        raise HTTPException(status_code=403, detail="Parents only")
    kids = list_children(db, current_user)
    return [
        {"id": str(k.id), "name": k.name,
         "class_name": k.class_name, "roll_number": k.roll_number}
        for k in kids
    ]


# ── Parent: full overview for one child ────────────────────────────────────
@router.get("/child/{student_id}/overview")
def child_overview(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    child = get_linked_child(db, current_user, student_id)
    log_event("info", "parent.view_child", user_id=str(current_user.id),
              role="parent", detail_child=student_id)

    # Grades (graded submissions)
    graded = db.query(Submission).filter(
        Submission.student_id == child.id,
        Submission.status == SubmissionStatus.graded,
    ).all()
    grades = []
    for s in graded:
        if not s.assignment:
            continue
        max_marks = s.assignment.max_marks or 0
        grades.append({
            "assignment_title": s.assignment.title,
            "subject": s.assignment.subject,
            "marks_obtained": s.marks_obtained,
            "max_marks": max_marks,
            "percentage": round(s.marks_obtained / max_marks * 100, 1) if max_marks else 0,
            "feedback": s.feedback,
            "graded_at": s.graded_at.isoformat() if s.graded_at else None,
        })

    # Attendance
    att = db.query(Attendance).filter(Attendance.student_id == child.id).all()
    present = sum(1 for r in att if r.is_present)
    total = len(att)
    attendance = {
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": round(present / total * 100, 1) if total else 0,
        "records": [
            {"date": r.date, "is_present": r.is_present, "subject": r.subject}
            for r in att
        ],
    }

    # Assignments for the child's class (published only)
    assignments = db.query(Assignment).filter(
        Assignment.class_name == child.class_name,
        Assignment.status == AssignmentStatus.published,
    ).all()
    assignment_list = [
        {"title": a.title, "subject": a.subject,
         "due_date": a.due_date.isoformat() if a.due_date else None,
         "max_marks": a.max_marks}
        for a in assignments
    ]

    # Upcoming exams for the child's class
    exams = db.query(Exam).filter(Exam.class_name == child.class_name).all()
    exam_list = [
        {"title": e.title, "subject": e.subject,
         "scheduled_at": e.scheduled_at.isoformat() if e.scheduled_at else None,
         "total_marks": e.total_marks, "status": e.status.value if e.status else None}
        for e in exams
    ]

    return {
        "child": {"id": str(child.id), "name": child.name,
                  "class_name": child.class_name, "roll_number": child.roll_number},
        "grades": grades,
        "attendance": attendance,
        "assignments": assignment_list,
        "upcoming_exams": exam_list,
    }


# ── Parent: fees for one child (from EduOS) ────────────────────────────────
@router.get("/child/{student_id}/fees")
def child_fees(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    child = get_linked_child(db, current_user, student_id)

    data = _eduos_fee_payload(token)
    if data is None:
        # EduOS not configured / unreachable / parent has no EduOS identity.
        raise HTTPException(status_code=502, detail="Fee data unavailable")

    students = data.get("students", []) if isinstance(data, dict) else []
    match = next(
        (s for s in students if s.get("roll_number") == child.roll_number),
        None,
    )
    log_event("info", "parent.view_fees", user_id=str(current_user.id),
              role="parent", detail_child=student_id)

    if not match:
        return {"roll_number": child.roll_number, "fees": [], "total_due": 0,
                "months_overdue": 0}
    return match
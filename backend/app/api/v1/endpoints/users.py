import json
import os
from datetime import datetime, timedelta
from urllib import error, request as urllib_request

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, Role, Submission, Assignment
from app.core.security import get_current_user, oauth2_scheme, decode_access_token, SECRET_KEY, ALGORITHM
from jose import jwt

router = APIRouter()


def fetch_eduos_students(token: str, class_name: str | None = None):
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    if not eduos_api_url:
        return None

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
        f"{eduos_api_url}/api/v1/students/",
        headers={"Authorization": f"Bearer {eduos_token}"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    students = []
    for student in data:
        if class_name and student.get("class_name") != class_name:
            continue
        full_name = student.get("full_name") or student.get("name")
        students.append({
            "id": str(student.get("id")),
            "name": full_name,
            "email": student.get("email") or "",
            "class_name": student.get("class_name"),
            "roll_number": student.get("roll_number"),
        })
    return students


@router.get("/students")
def list_students(
    class_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    eduos_students = fetch_eduos_students(token, class_name)
    if eduos_students is not None:
        return eduos_students
    query = db.query(User).filter(User.role == Role.student)
    if class_name:
        query = query.filter(User.class_name == class_name)
    students = query.all()
    return [{"id": str(s.id), "name": s.name, "email": s.email, "class_name": s.class_name, "roll_number": s.roll_number} for s in students]


@router.get("/teachers")
def list_teachers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    teachers = db.query(User).filter(User.role == Role.teacher).all()
    return [{"id": str(t.id), "name": t.name, "email": t.email, "subject": t.subject} for t in teachers]

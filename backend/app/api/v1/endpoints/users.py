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


def extract_eduos_context(token: str):
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    if not eduos_api_url:
        return None, None

    try:
        payload = decode_access_token(token)
    except Exception:
        return None, None

    eduos_sub = payload.get("eduos_sub")
    if not eduos_sub:
        return payload, None

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
    return payload, eduos_token


def build_eduos_token(token: str):
    _, eduos_token = extract_eduos_context(token)
    return eduos_token


def should_require_eduos_data(token: str) -> bool:
    payload, eduos_token = extract_eduos_context(token)
    return bool(payload and eduos_token)


def fetch_eduos_json(path: str, token: str):
    eduos_api_url = os.getenv("EDUOS_API_URL", "").rstrip("/")
    eduos_token = build_eduos_token(token)
    if not eduos_api_url or not eduos_token:
        return None

    req = urllib_request.Request(
        f"{eduos_api_url}{path}",
        headers={"Authorization": f"Bearer {eduos_token}"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"EduOS sync failed with status {exc.code}")
    except (error.URLError, TimeoutError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="EduOS sync failed")


def fetch_eduos_students(token: str, class_name: str | None = None):
    data = fetch_eduos_json("/api/v1/students/", token)
    if data is None:
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
            "section": student.get("section") or "",
            "roll_number": student.get("roll_number"),
        })
    return students


def fetch_eduos_teachers(token: str):
    data = fetch_eduos_json("/api/v1/teachers/", token)
    sections = fetch_eduos_json("/api/v1/academics/sections", token)
    if data is None or sections is None:
        return None

    teachers = []
    for teacher in data:
        teacher_id = str(teacher.get("id"))
        assigned_sections = [
            {
                "id": str(section.get("id")),
                "class_name": section.get("class_name"),
                "section": section.get("section") or "",
            }
            for section in sections
            if str(section.get("class_teacher_id") or "") == teacher_id
        ]
        teachers.append({
            "id": teacher_id,
            "name": teacher.get("full_name") or teacher.get("name"),
            "email": teacher.get("email") or "",
            "subject": teacher.get("subject"),
            "assigned_sections": assigned_sections,
        })
    return teachers


def fetch_eduos_teacher_detail(token: str, teacher_id: str):
    teachers = fetch_eduos_teachers(token)
    students = fetch_eduos_students(token)
    sections = fetch_eduos_json("/api/v1/academics/sections", token)
    if teachers is None or students is None or sections is None:
        return None

    teacher = next((t for t in teachers if t["id"] == teacher_id), None)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    assigned_sections = [
        {
            "id": str(section.get("id")),
            "class_name": section.get("class_name"),
            "section": section.get("section") or "",
        }
        for section in sections
        if str(section.get("class_teacher_id") or "") == teacher_id
    ]

    assigned_students = []
    seen_student_ids = set()
    for student in students:
        for section in assigned_sections:
            student_section = student.get("section") or ""
            if (
                student.get("class_name") == section["class_name"]
                and student_section == section["section"]
                and student["id"] not in seen_student_ids
            ):
                assigned_students.append(student)
                seen_student_ids.add(student["id"])
                break

    return {
        "teacher": teacher,
        "assigned_sections": assigned_sections,
        "assigned_students": assigned_students,
    }


@router.get("/students")
def list_students(
    class_name: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    if should_require_eduos_data(token):
        return fetch_eduos_students(token, class_name)
    eduos_students = fetch_eduos_students(token, class_name)
    if eduos_students is not None:
        return eduos_students
    query = db.query(User).filter(User.role == Role.student)
    if class_name:
        query = query.filter(User.class_name == class_name)
    students = query.all()
    return [{"id": str(s.id), "name": s.name, "email": s.email, "class_name": s.class_name, "roll_number": s.roll_number} for s in students]


@router.get("/teachers")
def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    if current_user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    if should_require_eduos_data(token):
        return fetch_eduos_teachers(token)
    eduos_teachers = fetch_eduos_teachers(token)
    if eduos_teachers is not None:
        return eduos_teachers
    teachers = db.query(User).filter(User.role == Role.teacher).all()
    return [{"id": str(t.id), "name": t.name, "email": t.email, "subject": t.subject} for t in teachers]


@router.get("/teachers/{teacher_id}")
def get_teacher_detail(
    teacher_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
):
    if current_user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403)
    if should_require_eduos_data(token):
        return fetch_eduos_teacher_detail(token, teacher_id)

    teacher = db.query(User).filter(User.id == teacher_id, User.role == Role.teacher).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return {
        "teacher": {"id": str(teacher.id), "name": teacher.name, "email": teacher.email, "subject": teacher.subject},
        "assigned_sections": [],
        "assigned_students": [],
    }

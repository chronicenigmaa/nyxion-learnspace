import json
import os
from datetime import datetime, timedelta
from urllib import error, request as urllib_request

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, Role, Submission, Assignment
from app.core.security import get_current_user, oauth2_scheme, decode_access_token, SECRET_KEY, ALGORITHM
from jose import jwt

router = APIRouter()


def normalize_class_filter(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    raw = value.strip()
    if not raw:
        return None, None
    lowered = raw.lower().replace("class", "").strip()
    normalized = lowered.replace(" ", "").replace("-", "")
    if len(normalized) >= 2 and normalized[-1].isalpha():
        return normalized[:-1], normalized[-1].upper()
    return lowered.upper(), None


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

    filter_class, filter_section = normalize_class_filter(class_name)
    students = []
    for student in data:
        student_class = str(student.get("class_name") or "").strip()
        student_section = str(student.get("section") or "").strip().upper()
        if filter_class:
            if student_class != filter_class:
                continue
            if filter_section is not None and student_section != filter_section:
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
    subjects = fetch_eduos_json("/api/v1/academics/subjects", token)
    if data is None or sections is None or subjects is None:
        return None

    teachers = []
    for teacher in data:
        teacher_id = str(teacher.get("id"))
        pair_map: dict[tuple[str, str], dict] = {}
        for section in sections:
            if str(section.get("class_teacher_id") or "") == teacher_id:
                class_name = section.get("class_name")
                section_name = section.get("section") or ""
                if class_name:
                    pair_map[(class_name, section_name)] = {
                        "id": str(section.get("id")),
                        "class_name": class_name,
                        "section": section_name,
                    }
        for subject in subjects:
            if str(subject.get("teacher_id") or "") == teacher_id:
                class_name = subject.get("class_name")
                section_name = subject.get("section") or ""
                if class_name:
                    pair_map.setdefault(
                        (class_name, section_name),
                        {
                            "id": f"subject-{subject.get('id')}",
                            "class_name": class_name,
                            "section": section_name,
                        },
                    )
        assigned_sections = list(pair_map.values())
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
    subjects = fetch_eduos_json("/api/v1/academics/subjects", token)
    if teachers is None or students is None or sections is None or subjects is None:
        return None

    teacher = next((t for t in teachers if t["id"] == teacher_id), None)
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    pair_map: dict[tuple[str, str], dict] = {}
    for section in sections:
        if str(section.get("class_teacher_id") or "") == teacher_id:
            class_name = section.get("class_name")
            section_name = section.get("section") or ""
            if class_name:
                pair_map[(class_name, section_name)] = {
                    "id": str(section.get("id")),
                    "class_name": class_name,
                    "section": section_name,
                }
    for subject in subjects:
        if str(subject.get("teacher_id") or "") == teacher_id:
            class_name = subject.get("class_name")
            section_name = subject.get("section") or ""
            if class_name:
                pair_map.setdefault(
                    (class_name, section_name),
                    {
                        "id": f"subject-{subject.get('id')}",
                        "class_name": class_name,
                        "section": section_name,
                    },
                )
    assigned_sections = list(pair_map.values())

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


class UpdateStudentRequest(BaseModel):
    class_name: str | None = None
    roll_number: str | None = None


@router.patch("/students/{student_id}")
def update_student(
    student_id: str,
    req: UpdateStudentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Admins only")
    import uuid as uuid_lib
    try:
        sid = uuid_lib.UUID(student_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid student id")
    student = db.query(User).filter(User.id == sid, User.role == Role.student).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if req.class_name is not None:
        student.class_name = req.class_name or None
    if req.roll_number is not None:
        student.roll_number = req.roll_number or None
    db.commit()
    db.refresh(student)
    return {
        "id": str(student.id),
        "name": student.name,
        "email": student.email,
        "class_name": student.class_name,
        "roll_number": student.roll_number,
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
    filter_class, filter_section = normalize_class_filter(class_name)
    query = db.query(User).filter(User.role == Role.student)
    students = query.all()
    result = []
    for s in students:
        student_class, student_section = normalize_class_filter(s.class_name)
        if filter_class:
            if student_class != filter_class:
                continue
            if filter_section is not None and student_section != filter_section:
                continue
        result.append({
            "id": str(s.id),
            "name": s.name,
            "email": s.email,
            "class_name": s.class_name,
            "section": student_section or "",
            "roll_number": s.roll_number,
        })
    return result


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

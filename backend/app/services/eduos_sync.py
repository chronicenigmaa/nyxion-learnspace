"""
Mirror EduOS's parent → student links into LearnSpace's parent_children.

PRODUCT:  LearnSpace
PATH:     app/services/eduos_sync.py

WHY THIS EXISTS
    Both products let an admin link a parent to a student, but they store the
    link in different schemas: EduOS in `eduos.student_parents` (parent user →
    `eduos.students` row), LearnSpace in `learnspace.parent_children` (parent
    user → `learnspace.users` row). Those student rows are unrelated records,
    so the link has to be reconciled rather than shared.

AUTHORITY
    EduOS wins. For every parent EduOS reports, this replaces that parent's
    LearnSpace links wholesale. A link created in LearnSpace's own parents page
    for such a parent WILL be removed on the next run — EduOS is the system of
    record for enrolment.

    Parents that EduOS does not mention are left completely alone. Absence of
    data is not treated as an instruction to delete, because the EduOS token
    may legitimately be scoped to one school.

MATCHING
    Parent  → by email (EduOS users and LearnSpace users are separate rows).
    Student → by roll_number, sourced from EduOS, scoped to the same school_id
              when both sides carry one.
    Anything that does not match is reported, never guessed at. This mirrors
    the rule in parents.py: never resolve a parent's child by name, because a
    collision would expose another family's child.

    Accounts are never created here. A parent who exists in EduOS but has no
    LearnSpace login is reported as unmatched so an admin can create them.

CONFIG
    EDUOS_API_URL         Base URL of the EduOS API. Unset disables the sync.
    EDUOS_SERVICE_TOKEN   An EduOS JWT belonging to a super_admin or
                          school_admin. Unset disables the sync.
"""

import logging
import os

import httpx
from sqlalchemy.orm import Session

from app.models.models import User, Role, ParentChild
from app.core.logging_client import log_event

logger = logging.getLogger("learnspace.eduos_sync")

REQUEST_TIMEOUT_SECONDS = 20


class SyncDisabled(Exception):
    """Raised when the EduOS bridge is not configured."""


def _fetch_parent_links() -> list[dict]:
    base = os.getenv("EDUOS_API_URL", "").rstrip("/")
    token = os.getenv("EDUOS_SERVICE_TOKEN", "")
    if not base or not token:
        raise SyncDisabled("EDUOS_API_URL and EDUOS_SERVICE_TOKEN must both be set")

    response = httpx.get(
        f"{base}/api/v1/students/parent-links",
        headers={"Authorization": f"Bearer {token}"},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("parents", []) if isinstance(payload, dict) else []


def _find_student(db: Session, roll_number: str, school_id: str | None) -> User | None:
    if not roll_number:
        return None
    query = db.query(User).filter(
        User.role == Role.student,
        User.roll_number == roll_number,
        User.is_active == True,  # noqa: E712 — SQLAlchemy needs the comparison
    )
    if school_id:
        # Only narrow by school when the LearnSpace row actually carries one;
        # otherwise a student with a null school_id would never match.
        scoped = query.filter(User.school_id == school_id)
        if scoped.count() == 1:
            return scoped.first()
    matches = query.all()
    # An ambiguous roll number must not be guessed at.
    return matches[0] if len(matches) == 1 else None


def sync_parent_links(db: Session) -> dict:
    """Reconcile parent_children from EduOS. Returns a report of what changed."""
    eduos_parents = _fetch_parent_links()

    report = {
        "parents_seen": len(eduos_parents),
        "parents_synced": 0,
        "links_created": 0,
        "links_removed": 0,
        "unmatched_parents": [],
        "unmatched_children": [],
    }

    for entry in eduos_parents:
        email = (entry.get("email") or "").strip().lower()
        if not email:
            continue

        parent = db.query(User).filter(
            User.email == email,
            User.role == Role.parent,
            User.is_active == True,  # noqa: E712
        ).first()
        if not parent:
            report["unmatched_parents"].append(email)
            continue

        school_id = entry.get("school_id")
        desired_ids = set()
        for child in entry.get("children", []):
            roll_number = (child.get("roll_number") or "").strip()
            if not roll_number:
                report["unmatched_children"].append(
                    {"parent": email, "child": child.get("full_name"), "reason": "no roll number in EduOS"}
                )
                continue
            student = _find_student(db, roll_number, school_id)
            if not student:
                report["unmatched_children"].append(
                    {"parent": email, "roll_number": roll_number, "reason": "no unique LearnSpace student"}
                )
                continue
            desired_ids.add(student.id)

        existing = db.query(ParentChild).filter(ParentChild.parent_id == parent.id).all()
        existing_ids = {link.student_id for link in existing}

        for link in existing:
            if link.student_id not in desired_ids:
                db.delete(link)
                report["links_removed"] += 1

        for student_id in desired_ids - existing_ids:
            db.add(ParentChild(parent_id=parent.id, student_id=student_id))
            report["links_created"] += 1

        report["parents_synced"] += 1

    db.commit()

    log_event(
        "info", "eduos.parent_sync",
        detail_parents=report["parents_synced"],
        detail_created=report["links_created"],
        detail_removed=report["links_removed"],
        detail_unmatched_parents=len(report["unmatched_parents"]),
        detail_unmatched_children=len(report["unmatched_children"]),
    )
    return report

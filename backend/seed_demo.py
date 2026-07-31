"""Seed the LearnSpace half of the Nyxion demo, mirroring EduOS.

Run from the backend/ directory with DATABASE_URL pointing at the TARGET
database:

    python seed_demo.py --wipe      # DELETES EVERYTHING, then seeds
    python seed_demo.py             # seeds only if the database is empty

WARNING — --wipe TRUNCATEs every LearnSpace table. There is no undo.

RUN THE EDUOS SEEDER FIRST. EduOS is the system of record for accounts; this
script only mirrors them so the portal has data to show before anyone has
signed in. The values below MUST match backend/seed_demo.py in the EduOS repo:

  * emails       — how LearnSpace recognises an EduOS user
  * roll numbers — how the parent-link sync matches students
  * school id    — LearnSpace filters timetable/coursebooks by it, and a user's
                   school_id is overwritten with EduOS's value on first login
  * class names  — EduOS class "8" + section "A" becomes "Class 8A" here, via
                   normalize_student_class_name() in auth.py

Seeds: the same 6 students, 3 teachers, 1 parent (2 children), plus LearnSpace's
own data — assignments with graded submissions, attendance, exams, notes,
calendar events, timetable and coursebooks.
"""

import argparse
import sys
from datetime import date, datetime, timedelta

sys.path.append(".")

from sqlalchemy import text

from app.db.database import Base, DB_SCHEMA, SessionLocal, engine, ensure_schema
from app.core.security import hash_password
from app.models.models import (
    User, Role, ParentChild, Assignment, AssignmentStatus, Submission,
    SubmissionStatus, Attendance, Exam, ExamStatus, Note, Event, Timetable,
    Coursebook,
)

PASSWORD = "Demo@123"
SCHOOL_ID = "11111111-2222-3333-4444-555555555555"  # keep in sync with EduOS

SUPER_ADMIN = {"email": "superadmin@nyxion.ai", "name": "Nyxion Super Admin"}
SCHOOL_ADMIN = {"email": "admin@demo.edu.pk", "name": "Imtiaz Qureshi"}
PARENT = {"email": "parent@demo.edu.pk", "name": "Hassan Ali"}

TEACHERS = [
    {"name": "Ms. Sara Ahmed",       "email": "sara@demo.edu.pk",   "subject": "Mathematics"},
    {"name": "Mr. Imran Khan",       "email": "imran@demo.edu.pk",  "subject": "English"},
    {"name": "Ms. Ayesha Siddiqui",  "email": "ayesha@demo.edu.pk", "subject": "Science"},
]

STUDENTS = [
    {"name": "Ali Hassan",    "email": "ali@demo.edu.pk",     "roll": "DEMO-001", "class_name": "Class 8A", "parent": True},
    {"name": "Fatima Khan",   "email": "fatima@demo.edu.pk",  "roll": "DEMO-002", "class_name": "Class 8A", "parent": False},
    {"name": "Bilal Ahmed",   "email": "bilal@demo.edu.pk",   "roll": "DEMO-003", "class_name": "Class 8A", "parent": False},
    {"name": "Zainab Hassan", "email": "zainab@demo.edu.pk",  "roll": "DEMO-004", "class_name": "Class 6A", "parent": True},
    {"name": "Hamza Sheikh",  "email": "hamza@demo.edu.pk",   "roll": "DEMO-005", "class_name": "Class 6A", "parent": False},
    {"name": "Ayesha Malik",  "email": "ayesham@demo.edu.pk", "roll": "DEMO-006", "class_name": "Class 6A", "parent": False},
]

SUBJECTS = ["Mathematics", "English", "Science"]
CLASSES = ["Class 8A", "Class 6A"]
PERIOD_TIMES = [("08:00", "08:45"), ("08:45", "09:30"), ("09:45", "10:30"), ("10:30", "11:15")]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6"]


def wipe() -> None:
    tables = ", ".join(f'"{DB_SCHEMA}"."{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    print("Wiped every LearnSpace table.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the LearnSpace demo.")
    parser.add_argument("--wipe", action="store_true",
                        help="DELETE ALL existing data first. Irreversible.")
    parser.add_argument("--allow-public-schema", action="store_true",
                        help="Permit seeding into the 'public' schema. Almost always wrong.")
    args = parser.parse_args()

    print(f"Target schema: {DB_SCHEMA}")

    # Seeding into "public" writes where the deployed app never looks, since it
    # runs with DB_SCHEMA=learnspace. The script would report success while
    # every login still failed.
    if DB_SCHEMA == "public" and not args.allow_public_schema:
        print(
            "\nRefusing to run against the 'public' schema.\n"
            "LearnSpace runs with DB_SCHEMA=learnspace, so anything seeded into "
            "'public' is invisible to the app.\n\n"
            "  DATABASE_URL=... DB_SCHEMA=learnspace python seed_demo.py --wipe\n\n"
            "Pass --allow-public-schema only if you genuinely mean 'public'.",
            file=sys.stderr,
        )
        return 1

    ensure_schema(engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(User).count()
        if existing and not args.wipe:
            print(
                f"\nRefusing to seed: {existing} user(s) already exist.\n"
                "Re-run with --wipe to DELETE everything first.",
                file=sys.stderr,
            )
            return 1
    finally:
        db.close()

    if args.wipe:
        print(f"\n!! About to DELETE ALL DATA in the '{DB_SCHEMA}' schema.")
        if input("Type the word DELETE to continue: ").strip() != "DELETE":
            print("Aborted. Nothing was changed.")
            return 1
        wipe()

    db = SessionLocal()
    try:
        def make_user(email, name, role, **extra):
            user = User(
                email=email, name=name, role=role,
                password_hash=hash_password(PASSWORD),
                school_id=SCHOOL_ID, is_active=True, **extra,
            )
            db.add(user)
            return user

        make_user(SUPER_ADMIN["email"], SUPER_ADMIN["name"], Role.super_admin,
                  avatar_color=COLORS[0])
        make_user(SCHOOL_ADMIN["email"], SCHOOL_ADMIN["name"], Role.school_admin,
                  avatar_color=COLORS[2])
        parent_user = make_user(PARENT["email"], PARENT["name"], Role.parent,
                                avatar_color=COLORS[5])

        teachers = {}
        for index, data in enumerate(TEACHERS):
            teachers[data["subject"]] = make_user(
                data["email"], data["name"], Role.teacher,
                subject=data["subject"], avatar_color=COLORS[index % len(COLORS)],
            )

        students = []
        for index, data in enumerate(STUDENTS):
            user = make_user(
                data["email"], data["name"], Role.student,
                class_name=data["class_name"], roll_number=data["roll"],
                avatar_color=COLORS[index % len(COLORS)],
            )
            students.append((user, data))
        db.flush()

        # ── Parent → children
        for user, data in students:
            if data["parent"]:
                db.add(ParentChild(parent_id=parent_user.id, student_id=user.id))

        # ── Timetable + coursebooks + notes, per class
        for class_name in CLASSES:
            for day in DAYS:
                for period, (start, end) in enumerate(PERIOD_TIMES, start=1):
                    subject = SUBJECTS[(period - 1) % len(SUBJECTS)]
                    db.add(Timetable(
                        day=day, period=f"{period}", subject=subject,
                        teacher_name=teachers[subject].name, class_name=class_name,
                        start_time=start, end_time=end, school_id=SCHOOL_ID,
                    ))
            for subject in SUBJECTS:
                db.add(Coursebook(
                    title=f"{subject} — {class_name} Textbook", subject=subject,
                    class_name=class_name,
                    description=f"Core {subject.lower()} coursebook for {class_name}",
                    file_name="demo.pdf", school_id=SCHOOL_ID,
                ))
                db.add(Note(
                    title=f"{subject} — Chapter Notes", subject=subject,
                    class_name=class_name, teacher_id=teachers[subject].id,
                    description=f"Revision notes shared by {teachers[subject].name}.",
                    files=[],
                ))

        # ── Assignments, one per subject per class, with graded submissions
        today = date.today()
        marks_cycle = [46, 38, 29, 48, 33, 42]
        for class_name in CLASSES:
            class_students = [u for u, d in students if d["class_name"] == class_name]
            for offset, subject in enumerate(SUBJECTS):
                assignment = Assignment(
                    title=f"{subject} Worksheet {offset + 1}", subject=subject,
                    class_name=class_name, teacher_id=teachers[subject].id,
                    description=f"Complete the {subject.lower()} exercises.",
                    due_date=datetime.combine(today + timedelta(days=3 + offset * 4), datetime.min.time()),
                    max_marks=50, status=AssignmentStatus.published, attachments=[],
                )
                db.add(assignment)
                db.flush()

                for index, student in enumerate(class_students):
                    # Leave the last assignment unsubmitted so "pending work" is non-zero.
                    if offset == len(SUBJECTS) - 1:
                        db.add(Submission(
                            assignment_id=assignment.id, student_id=student.id,
                            status=SubmissionStatus.not_submitted, files=[],
                        ))
                        continue
                    obtained = marks_cycle[(index + offset) % len(marks_cycle)]
                    db.add(Submission(
                        assignment_id=assignment.id, student_id=student.id,
                        content=f"{subject} worksheet submission.", files=[],
                        status=SubmissionStatus.graded,
                        submitted_at=datetime.utcnow() - timedelta(days=2),
                        marks_obtained=obtained,
                        feedback="Well presented." if obtained >= 40 else "Review the worked examples.",
                        graded_at=datetime.utcnow() - timedelta(days=1),
                        graded_by=teachers[subject].id,
                    ))

            # ── Exams
            for offset, subject in enumerate(SUBJECTS[:2]):
                db.add(Exam(
                    title=f"{subject} Term 1 Exam", subject=subject, class_name=class_name,
                    teacher_id=teachers[subject].id, duration_minutes=60, total_marks=100,
                    scheduled_at=datetime.combine(today + timedelta(days=7 + offset * 3), datetime.min.time()),
                    status=ExamStatus.scheduled, questions=[],
                ))

        # ── Attendance: 30 school days per student
        for user, data in students:
            marked = 0
            day_offset = 0
            while marked < 30:
                day = today - timedelta(days=day_offset)
                day_offset += 1
                if day.weekday() >= 5:
                    continue
                marked += 1
                db.add(Attendance(
                    student_id=user.id, class_name=data["class_name"],
                    date=day.isoformat(), is_present=marked % 13 != 0,
                ))

        # ── Calendar
        for title, description, event_type, day_offset, color in (
            ("Parent-Teacher Meeting", "PTM for all classes, 9am to 1pm.", "event", 5, "#6366f1"),
            ("Term 1 Exams Begin", "Term 1 examinations start.", "exam", 7, "#ef4444"),
            ("Independence Day", "School closed.", "holiday", 14, "#10b981"),
            ("Fee Deadline", "July fees due.", "deadline", 10, "#f59e0b"),
        ):
            db.add(Event(
                title=title, description=description, event_type=event_type,
                date=(today + timedelta(days=day_offset)).isoformat(),
                color=color, all_day=True,
            ))

        db.commit()

        print(f"""
Seeded the LearnSpace demo (school id {SCHOOL_ID}).

  {len(STUDENTS)} students, {len(TEACHERS)} teachers, 1 parent linked to 2 children
  timetable, coursebooks, notes, assignments with graded submissions,
  exams, 30 days attendance, 4 calendar events

All passwords: {PASSWORD}

  Super admin   {SUPER_ADMIN['email']}
  School admin  {SCHOOL_ADMIN['email']}
  Parent        {PARENT['email']}  (Ali Hassan DEMO-001, Zainab Hassan DEMO-004)
  Teachers      {', '.join(t['email'] for t in TEACHERS)}
  Students      {', '.join(s['email'] for s in STUDENTS)}

Run the EduOS seeder too if you haven't — it owns the accounts, fees and results.
""")
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

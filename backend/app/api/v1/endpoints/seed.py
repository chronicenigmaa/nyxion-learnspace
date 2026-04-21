from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import User, Role, Assignment, Submission, Attendance, Note, Event, AssignmentStatus, SubmissionStatus
from app.core.security import hash_password
from datetime import datetime, timedelta
import random
import uuid

router = APIRouter()


@router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    created = []

    # ── GENERIC DEMO USERS
    demo_users = [
        {
            "name": "Teacher Demo",
            "email": "teacher@demo.com",
            "password": "demo123",
            "role": Role.teacher,
            "subject": "General Studies",
            "avatar_color": "#6366f1",
        },
        {
            "name": "Student Demo",
            "email": "student@demo.com",
            "password": "demo123",
            "role": Role.student,
            "class_name": "Class 9A",
            "roll_number": "09A-000",
            "avatar_color": "#10b981",
        },
        {
            "name": "Admin Demo",
            "email": "admin@demo.com",
            "password": "demo123",
            "role": Role.school_admin,
            "avatar_color": "#f59e0b",
        },
        {
            "name": "Al Noor Admin",
            "email": "admin@alnooracademy.com",
            "password": "admin123",
            "role": Role.school_admin,
            "school_id": "ALNOOR-ACADEMY",
            "avatar_color": "#f59e0b",
        },
    ]
    for data in demo_users:
        user = db.query(User).filter(User.email == data["email"]).first()
        if not user:
            user = User(email=data["email"])
            db.add(user)
            created.append(data["email"])
        user.name = data["name"]
        user.password_hash = hash_password(data["password"])
        user.role = data["role"]
        user.school_id = data.get("school_id")
        user.subject = data.get("subject")
        user.class_name = data.get("class_name")
        user.roll_number = data.get("roll_number")
        user.avatar_color = data["avatar_color"]
        user.is_active = True
        db.flush()

    # ── TEACHERS
    teachers_data = [
        {"name": "Ms. Fatima Malik",    "email": "fatima@demo.com",   "subject": "Mathematics"},
        {"name": "Mr. Usman Tariq",     "email": "usman@demo.com",    "subject": "Physics"},
        {"name": "Ms. Ayesha Siddiqui", "email": "ayesha@demo.com",   "subject": "English"},
        {"name": "Mr. Bilal Ahmed",     "email": "bilal@demo.com",    "subject": "Chemistry"},
        {"name": "Ms. Sana Qureshi",    "email": "sana@demo.com",     "subject": "Biology"},
    ]
    teachers = []
    for t in teachers_data:
        if not db.query(User).filter(User.email == t["email"]).first():
            u = User(name=t["name"], email=t["email"],
                     password_hash=hash_password("demo123"),
                     role=Role.teacher, subject=t["subject"],
                     avatar_color=random.choice(["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b"]))
            db.add(u); db.flush(); teachers.append(u); created.append(t["email"])
        else:
            teachers.append(db.query(User).filter(User.email == t["email"]).first())

    # ── STUDENTS
    students_data = [
        # Class 9A
        {"name": "Ahmed Khan",       "email": "ahmed@demo.com",    "class_name": "Class 9A", "roll": "09A-001"},
        {"name": "Sara Malik",       "email": "sara@demo.com",     "class_name": "Class 9A", "roll": "09A-002"},
        {"name": "Hassan Ali",       "email": "hassan@demo.com",   "class_name": "Class 9A", "roll": "09A-003"},
        {"name": "Zara Hussain",     "email": "zara@demo.com",     "class_name": "Class 9A", "roll": "09A-004"},
        {"name": "Omar Sheikh",      "email": "omar@demo.com",     "class_name": "Class 9A", "roll": "09A-005"},
        {"name": "Hina Baig",        "email": "hina@demo.com",     "class_name": "Class 9A", "roll": "09A-006"},
        # Class 9B
        {"name": "Kamran Javed",     "email": "kamran@demo.com",   "class_name": "Class 9B", "roll": "09B-001"},
        {"name": "Nadia Iqbal",      "email": "nadia@demo.com",    "class_name": "Class 9B", "roll": "09B-002"},
        {"name": "Tariq Mehmood",    "email": "tariq@demo.com",    "class_name": "Class 9B", "roll": "09B-003"},
        {"name": "Amna Farooq",      "email": "amna@demo.com",     "class_name": "Class 9B", "roll": "09B-004"},
        # Class 10A
        {"name": "Imran Butt",       "email": "imran@demo.com",    "class_name": "Class 10A", "roll": "10A-001"},
        {"name": "Rabia Noor",       "email": "rabia@demo.com",    "class_name": "Class 10A", "roll": "10A-002"},
        {"name": "Faisal Chaudhry",  "email": "faisal@demo.com",   "class_name": "Class 10A", "roll": "10A-003"},
        {"name": "Mahnoor Shah",     "email": "mahnoor@demo.com",  "class_name": "Class 10A", "roll": "10A-004"},
    ]
    students = []
    colors = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6"]
    for s in students_data:
        if not db.query(User).filter(User.email == s["email"]).first():
            u = User(name=s["name"], email=s["email"],
                     password_hash=hash_password("demo123"),
                     role=Role.student, class_name=s["class_name"],
                     roll_number=s["roll"], avatar_color=random.choice(colors))
            db.add(u); db.flush(); students.append(u); created.append(s["email"])
        else:
            students.append(db.query(User).filter(User.email == s["email"]).first())

    db.commit()

    # ── ASSIGNMENTS
    now = datetime.utcnow()
    assignments_data = [
        {"title": "Algebra — Chapter 5 Exercises",    "subject": "Mathematics", "class_name": "Class 9A",  "teacher": teachers[0], "days": 7,   "max": 50},
        {"title": "Quadratic Equations Worksheet",    "subject": "Mathematics", "class_name": "Class 9B",  "teacher": teachers[0], "days": 5,   "max": 40},
        {"title": "Newton's Laws Lab Report",         "subject": "Physics",     "class_name": "Class 9A",  "teacher": teachers[1], "days": 10,  "max": 100},
        {"title": "Wave Motion Notes Summary",        "subject": "Physics",     "class_name": "Class 10A", "teacher": teachers[1], "days": -2,  "max": 30},
        {"title": "Essay: My Favourite Book",         "subject": "English",     "class_name": "Class 9A",  "teacher": teachers[2], "days": 3,   "max": 25},
        {"title": "Grammar Exercises — Unit 4",       "subject": "English",     "class_name": "Class 9B",  "teacher": teachers[2], "days": 6,   "max": 20},
        {"title": "Periodic Table Quiz Preparation",  "subject": "Chemistry",   "class_name": "Class 10A", "teacher": teachers[3], "days": 4,   "max": 60},
        {"title": "Organic Chemistry Reactions",      "subject": "Chemistry",   "class_name": "Class 9A",  "teacher": teachers[3], "days": -5,  "max": 80},
        {"title": "Cell Division Diagrams",           "subject": "Biology",     "class_name": "Class 9B",  "teacher": teachers[4], "days": 8,   "max": 40},
        {"title": "Photosynthesis Experiment",        "subject": "Biology",     "class_name": "Class 10A", "teacher": teachers[4], "days": 2,   "max": 50},
    ]

    saved_assignments = []
    for a in assignments_data:
        existing = db.query(Assignment).filter(Assignment.title == a["title"]).first()
        if not existing:
            status = AssignmentStatus.closed if a["days"] < 0 else AssignmentStatus.published
            asgn = Assignment(
                title=a["title"], subject=a["subject"], class_name=a["class_name"],
                teacher_id=a["teacher"].id,
                due_date=now + timedelta(days=a["days"]),
                max_marks=a["max"], status=status, allow_late=False,
            )
            db.add(asgn); db.flush(); saved_assignments.append(asgn)
        else:
            saved_assignments.append(existing)
    db.commit()

    # ── SUBMISSIONS with marks
    for asgn in saved_assignments:
        class_students = [s for s in students if s.class_name == asgn.class_name]
        for student in class_students:
            existing = db.query(Submission).filter(
                Submission.assignment_id == asgn.id,
                Submission.student_id == student.id
            ).first()
            if not existing:
                # 80% chance student submitted
                if random.random() < 0.8:
                    marks = round(random.uniform(asgn.max_marks * 0.45, asgn.max_marks), 1)
                    feedbacks = [
                        "Good work, keep it up!",
                        "Well done. Review section 3 again.",
                        "Satisfactory. More detail needed.",
                        "Excellent effort!",
                        "Needs improvement in methodology.",
                        "Very good. Almost perfect.",
                        "Good attempt. Work on presentation.",
                    ]
                    sub = Submission(
                        assignment_id=asgn.id, student_id=student.id,
                        content=f"Submission for {asgn.title} by {student.name}. "
                                "Completed all required sections as per instructions provided in class.",
                        status=SubmissionStatus.graded,
                        submitted_at=now - timedelta(days=random.randint(1, 3)),
                        marks_obtained=marks,
                        feedback=random.choice(feedbacks),
                        plagiarism_score=round(random.uniform(0, 25), 1),
                        graded_at=now - timedelta(hours=random.randint(2, 48)),
                    )
                    db.add(sub)
    db.commit()

    # ── ATTENDANCE (last 30 days)
    all_classes = list(set(s.class_name for s in students))
    for i in range(30):
        day = now - timedelta(days=i)
        if day.weekday() >= 5:  # skip weekends
            continue
        date_str = day.strftime("%Y-%m-%d")
        for student in students:
            existing = db.query(Attendance).filter(
                Attendance.student_id == student.id, Attendance.date == date_str
            ).first()
            if not existing:
                # 88% attendance rate
                att = Attendance(
                    student_id=student.id, class_name=student.class_name,
                    date=date_str, is_present=random.random() < 0.88,
                    marked_by=teachers[0].id,
                )
                db.add(att)
    db.commit()

    # ── EVENTS / HOLIDAYS CALENDAR (Pakistan school calendar 2025-2026)
    events_data = [
        # Holidays
        {"title": "Eid ul Fitr",            "type": "holiday", "date": "2026-03-30", "end": "2026-04-01"},
        {"title": "Pakistan Day",           "type": "holiday", "date": "2026-03-23"},
        {"title": "Labour Day",             "type": "holiday", "date": "2026-05-01"},
        {"title": "Eid ul Adha",            "type": "holiday", "date": "2026-06-06", "end": "2026-06-08"},
        {"title": "Independence Day",       "type": "holiday", "date": "2026-08-14"},
        {"title": "Iqbal Day",              "type": "holiday", "date": "2026-11-09"},
        {"title": "Quaid-e-Azam Day",       "type": "holiday", "date": "2026-12-25"},
        {"title": "Winter Break Begins",    "type": "holiday", "date": "2025-12-20", "end": "2026-01-04"},
        {"title": "Summer Vacation",        "type": "holiday", "date": "2026-06-15", "end": "2026-08-07"},
        # Exams
        {"title": "Mid-Term Exams Begin",   "type": "exam",    "date": "2026-05-04", "end": "2026-05-10"},
        {"title": "Final Exams Begin",      "type": "exam",    "date": "2026-11-02", "end": "2026-11-14"},
        {"title": "Unit Test — Class 9",    "type": "exam",    "date": "2026-04-28"},
        {"title": "Unit Test — Class 10",   "type": "exam",    "date": "2026-04-29"},
        # Events
        {"title": "Annual Sports Day",      "type": "event",   "date": "2026-03-07"},
        {"title": "Science Fair",           "type": "event",   "date": "2026-04-15"},
        {"title": "Parent-Teacher Meeting", "type": "event",   "date": "2026-05-16"},
        {"title": "Prize Distribution",     "type": "event",   "date": "2026-11-28"},
        {"title": "Annual Function",        "type": "event",   "date": "2026-12-05"},
        {"title": "Tree Plantation Drive",  "type": "event",   "date": "2026-02-14"},
        # Announcements / Deadlines
        {"title": "Fee Submission Deadline",    "type": "deadline", "date": "2026-04-10"},
        {"title": "Fee Submission Deadline",    "type": "deadline", "date": "2026-05-10"},
        {"title": "Form Submission — Class 10", "type": "deadline", "date": "2026-09-15"},
        {"title": "Result Cards Distribution",  "type": "announcement", "date": "2026-05-20"},
        {"title": "New Admissions Open",        "type": "announcement", "date": "2026-08-15"},
    ]

    event_colors = {
        "holiday": "#ef4444",
        "exam": "#f59e0b",
        "event": "#10b981",
        "deadline": "#8b5cf6",
        "announcement": "#06b6d4",
    }

    for e in events_data:
        existing = db.query(Event).filter(Event.title == e["title"], Event.date == e["date"]).first()
        if not existing:
            ev = Event(
                title=e["title"], event_type=e["type"],
                date=e["date"], end_date=e.get("end"),
                color=event_colors.get(e["type"], "#6366f1"),
            )
            db.add(ev)
    db.commit()

    return {
        "message": "Demo data seeded successfully",
        "created": created,
        "summary": {
            "teachers": len(teachers_data),
            "students": len(students_data),
            "assignments": len(assignments_data),
            "events": len(events_data),
        }
    }

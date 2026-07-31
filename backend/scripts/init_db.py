"""
Create every LearnSpace table in Postgres (Supabase) and seed login accounts.

PRODUCT:  LearnSpace
PATH:     backend/scripts/init_db.py

Idempotent: safe to run repeatedly. Tables are created only if missing, and
accounts are updated in place rather than duplicated.

USAGE
    cd backend
    pip install -r requirements.txt

    # Supabase → Project Settings → Database → Connection string → URI
    # Use the SESSION POOLER string (port 5432) or the direct connection.
    export DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"

    python scripts/init_db.py --super-admin-email you@school.com \
                              --super-admin-name "Your Name" \
                              --super-admin-password 'a-strong-password'

    # add the demo teacher/student/admin logins too
    python scripts/init_db.py --demo

FLAGS
    --database-url URL     override $DATABASE_URL
    --demo                 also create the demo accounts (teacher/student/admin)
    --reset-passwords      overwrite passwords of existing demo accounts
    --drop-all             DESTRUCTIVE: drop every LearnSpace table first
"""

import argparse
import os
import random
import sys

# Make "app.*" importable when this file is run as backend/scripts/init_db.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, func, inspect  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.database import DB_SCHEMA, Base, ensure_schema  # noqa: E402
from app.models.models import (  # noqa: E402  (import registers every table on Base)
    Assignment, Attendance, Coursebook, Event, Exam, ExamAttempt,
    Note, ParentChild, Role, Submission, Timetable, User,
)

AVATAR_COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"]

DEMO_ACCOUNTS = [
    {"name": "Admin Demo",   "email": "admin@demo.com",   "password": "demo123",
     "role": Role.school_admin, "avatar_color": "#d97706"},
    {"name": "Teacher Demo", "email": "teacher@demo.com", "password": "demo123",
     "role": Role.teacher, "subject": "General Studies", "avatar_color": "#4f46e5"},
    {"name": "Student Demo", "email": "student@demo.com", "password": "demo123",
     "role": Role.student, "class_name": "Class 9A", "roll_number": "09A-000",
     "avatar_color": "#059669"},
    {"name": "Parent Demo",  "email": "parent@demo.com",  "password": "demo123",
     "role": Role.parent, "avatar_color": "#7c3aed"},
]


def upsert_user(db, *, name, email, password, role, reset_password=True, **extra):
    """Create the user, or update it in place if the email already exists."""
    normalized = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized).first()
    created = user is None
    if created:
        user = User(email=normalized, avatar_color=random.choice(AVATAR_COLORS))
        db.add(user)

    user.name = name
    user.role = role
    user.is_active = True
    if created or reset_password:
        user.password_hash = hash_password(password)
    for key, value in extra.items():
        if value is not None:
            setattr(user, key, value)

    db.flush()
    return user, created


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialise the LearnSpace database.")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    parser.add_argument("--super-admin-email")
    parser.add_argument("--super-admin-name", default="Super Admin")
    parser.add_argument("--super-admin-password")
    parser.add_argument("--demo", action="store_true", help="also seed demo login accounts")
    parser.add_argument("--reset-passwords", action="store_true",
                        help="overwrite passwords on accounts that already exist")
    parser.add_argument("--drop-all", action="store_true",
                        help="DESTRUCTIVE: drop all LearnSpace tables before creating them")
    args = parser.parse_args()

    database_url = args.database_url
    if not database_url:
        print("ERROR: no database URL. Pass --database-url or set $DATABASE_URL.", file=sys.stderr)
        return 2
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    safe_url = database_url.split("@")[-1] if "@" in database_url else database_url
    print(f"→ Connecting to {safe_url}")
    engine = create_engine(database_url, pool_pre_ping=True)

    if args.drop_all:
        confirm = input("This DROPS every LearnSpace table and all data. Type 'DROP' to confirm: ")
        if confirm.strip() != "DROP":
            print("Aborted.")
            return 1
        Base.metadata.drop_all(bind=engine)
        print("→ Dropped all tables")

    ensure_schema(engine)
    Base.metadata.create_all(bind=engine)
    tables = sorted(inspect(engine).get_table_names(schema=DB_SCHEMA))
    print(f"→ Schema '{DB_SCHEMA}' ready. {len(tables)} tables present:")
    for t in tables:
        print(f"    · {t}")

    Session = sessionmaker(bind=engine)
    db = Session()
    summary = {"created": [], "updated": []}

    try:
        if args.super_admin_email:
            if not args.super_admin_password:
                print("ERROR: --super-admin-password is required with --super-admin-email",
                      file=sys.stderr)
                return 2
            if len(args.super_admin_password) < 10:
                print("ERROR: super admin password must be at least 10 characters",
                      file=sys.stderr)
                return 2
            user, created = upsert_user(
                db,
                name=args.super_admin_name,
                email=args.super_admin_email,
                password=args.super_admin_password,
                role=Role.super_admin,
                reset_password=True,
            )
            summary["created" if created else "updated"].append(
                f"{user.email} (super_admin)")

        if args.demo:
            for account in DEMO_ACCOUNTS:
                data = dict(account)
                user, created = upsert_user(
                    db,
                    name=data.pop("name"),
                    email=data.pop("email"),
                    password=data.pop("password"),
                    role=data.pop("role"),
                    reset_password=args.reset_passwords,
                    **data,
                )
                summary["created" if created else "updated"].append(
                    f"{user.email} ({user.role.value})")

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()

    if summary["created"]:
        print("→ Accounts created:")
        for line in summary["created"]:
            print(f"    + {line}")
    if summary["updated"]:
        print("→ Accounts updated:")
        for line in summary["updated"]:
            print(f"    ~ {line}")
    if not summary["created"] and not summary["updated"]:
        print("→ No accounts requested. Pass --super-admin-email and/or --demo.")

    db2 = Session()
    try:
        counts = {
            "users": db2.query(User).count(),
            "super_admins": db2.query(User).filter(User.role == Role.super_admin).count(),
            "assignments": db2.query(Assignment).count(),
            "exams": db2.query(Exam).count(),
        }
    finally:
        db2.close()
    print(f"→ Done. {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

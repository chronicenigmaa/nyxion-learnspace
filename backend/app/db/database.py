import os

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/learnspace")

# Railway fix: replace postgres:// with postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# LearnSpace and EduOS share one Supabase project, and both define tables named
# `users`, `events`, etc. Every LearnSpace table therefore lives in its own
# Postgres schema so the two products cannot collide. EduOS should set its own
# DB_SCHEMA (e.g. "eduos") against the same DATABASE_URL.
#
# Anything genuinely shared between the products (the `app_logs` table written
# by app/core/logging_client.py) stays in `public`, because Supabase's REST API
# only exposes `public` unless you add a schema under
# Project Settings → API → Exposed schemas.
DB_SCHEMA = os.getenv("DB_SCHEMA", "learnspace")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base(metadata=MetaData(schema=DB_SCHEMA))


def ensure_schema(bind=None) -> None:
    """
    Create the product schema if it is missing.

    SQLAlchemy's create_all() will not create a schema, so this has to run
    before it or the first deploy fails with 'schema does not exist'.
    """
    if not DB_SCHEMA or DB_SCHEMA == "public":
        return
    target = bind or engine
    with target.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

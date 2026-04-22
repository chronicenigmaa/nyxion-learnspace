import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.endpoints import auth, assignments, submissions, grades, attendance, exams, notes, users, events, seed
from app.db.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Nyxion LearnSpace API",
    version="1.0.0",
    description="Assignment & Learning Portal for Nyxion EduOS"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/v1/auth",        tags=["auth"])
app.include_router(users.router,       prefix="/api/v1/users",       tags=["users"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["assignments"])
app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
app.include_router(grades.router,      prefix="/api/v1/grades",      tags=["grades"])
app.include_router(attendance.router,  prefix="/api/v1/attendance",  tags=["attendance"])
app.include_router(exams.router,       prefix="/api/v1/exams",       tags=["exams"])
app.include_router(notes.router,       prefix="/api/v1/notes",       tags=["notes"])
app.include_router(events.router,      prefix="/api/v1/events",      tags=["events"])
app.include_router(seed.router,        prefix="/api/v1/seed",        tags=["seed"])

os.makedirs("/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/uploads"), name="uploads")

@app.get("/health")
def health():
    return {"status": "ok", "service": "Nyxion LearnSpace"}

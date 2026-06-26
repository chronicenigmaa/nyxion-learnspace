import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from app.core.logging_client import log_event
from app.api.v1.endpoints import (
    auth, users, assignments, submissions, grades, attendance,
    exams, notes, events, seed, ai, timetable, coursebooks,
    parents,
)
from app.db.database import engine, Base

Base.metadata.create_all(bind=engine)

# 1) create the app FIRST
app = FastAPI(
    title="Nyxion LearnSpace API",
    version="1.0.0",
    description="Assignment & Learning Portal for Nyxion EduOS",
)

# 2) CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3) logging middleware — must come AFTER app = FastAPI(...)
@app.middleware("http")
async def access_logger(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log_event("error", "request.unhandled",
                  method=request.method, path=request.url.path, status_code=500,
                  duration_ms=int((time.perf_counter() - start) * 1000),
                  ip=request.client.host if request.client else None)
        raise
    log_event("info" if response.status_code < 400 else "warning", "request",
              method=request.method, path=request.url.path,
              status_code=response.status_code,
              duration_ms=int((time.perf_counter() - start) * 1000),
              ip=request.client.host if request.client else None)
    return response

# 4) routers
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
app.include_router(ai.router,          prefix="/api/v1/ai",          tags=["ai"])
app.include_router(timetable.router,   prefix="/api/v1/timetable",   tags=["timetable"])
app.include_router(coursebooks.router, prefix="/api/v1/coursebooks", tags=["coursebooks"])
app.include_router(parents.router,     prefix="/api/v1/parents",     tags=["parents"])

# 5) uploads + health
os.makedirs("/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/uploads"), name="uploads")

@app.get("/health")
def health():
    return {"status": "ok", "service": "Nyxion LearnSpace"}
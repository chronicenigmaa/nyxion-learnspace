from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os

from app.db.database import get_db
from app.models.models import User, Role
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# ── Groq helper (same pattern as EduOS) ───────────────────────
async def call_ai(system: str, prompt: str, max_tokens: int = 2048) -> str:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured. Set GROQ_API_KEY in Railway.")
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7
                }
            )
            result = response.json()
            if "choices" not in result:
                raise HTTPException(status_code=503, detail=f"AI error: {result}")
            return result["choices"][0]["message"]["content"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI error: {str(e)}")

def teacher_only(current_user: User):
    if current_user.role not in [Role.teacher, Role.school_admin, Role.super_admin]:
        raise HTTPException(status_code=403, detail="Teachers only")

# ── Request models ─────────────────────────────────────────────
class ExamGenRequest(BaseModel):
    subject: str
    class_name: str
    topic: str
    num_questions: int = 10
    difficulty: str = "medium"
    question_type: str = "mixed"

class HomeworkGenRequest(BaseModel):
    subject: str
    class_name: str
    topic: str
    difficulty: str = "medium"
    num_questions: int = 5

class LessonPlanRequest(BaseModel):
    subject: str
    class_name: str
    topic: str
    duration_minutes: int = 45
    learning_objectives: Optional[str] = None

class PlagiarismRequest(BaseModel):
    text: str
    assignment_title: str

class FeedbackRequest(BaseModel):
    submission_text: str
    marks_obtained: float
    max_marks: float
    subject: str
    assignment_title: Optional[str] = None

class SummariseRequest(BaseModel):
    text: str
    subject: Optional[str] = None

class FlashcardRequest(BaseModel):
    text: str
    num_cards: int = 10
    subject: Optional[str] = None

class RubricRequest(BaseModel):
    assignment_title: str
    subject: str
    max_marks: int
    description: Optional[str] = None

class StudyPlanRequest(BaseModel):
    upcoming_exams: List[str]
    upcoming_assignments: List[str]
    days_available: int = 7

# ── 1. Exam Generator ──────────────────────────────────────────
@router.post("/exam-generator")
async def generate_exam(
    req: ExamGenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    prompt = (
        f"Generate {req.num_questions} {req.question_type} questions for:\n"
        f"Subject: {req.subject}, Class: {req.class_name}, Topic: {req.topic}, Difficulty: {req.difficulty}\n"
        f"Mix question types: MCQ, short answer, and one application question.\n"
        f"Format clearly with question numbers and marks. Include an answer key at the end."
    )
    response = await call_ai(
        "You are an expert Pakistani school teacher. Generate well-structured exam questions. "
        "Format clearly with question numbers, marks, and question types.",
        prompt
    )
    return {"response": response, "model": "Llama 3.3 70B"}

# ── 2. Homework Generator ──────────────────────────────────────
@router.post("/homework-generator")
async def homework_generator(
    req: HomeworkGenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    prompt = (
        f"Generate {req.num_questions} homework questions for:\n"
        f"Subject: {req.subject}, Class: {req.class_name}, Topic: {req.topic}, Difficulty: {req.difficulty}\n"
        f"Mix question types: MCQ, short answer, and one application question.\n"
        f"Format clearly with question numbers. Include an answer key at the end."
    )
    response = await call_ai(
        "You are an expert Pakistani school teacher. Generate well-structured exam questions. "
        "Format clearly with question numbers, marks, and question types.",
        prompt
    )
    return {"response": response, "model": "Llama 3.3 70B"}

# ── 3. Lesson Planner ──────────────────────────────────────────
@router.post("/lesson-planner")
async def lesson_planner(
    req: LessonPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    obj = f"\nLearning objectives: {req.learning_objectives}" if req.learning_objectives else ""
    prompt = (
        f"Create a {req.duration_minutes}-minute lesson plan for:\n"
        f"Subject: {req.subject}, Class: {req.class_name}, Topic: {req.topic}{obj}\n"
        f"Include: Learning Objectives, Materials Needed, Introduction (5 min), "
        f"Main Activity, Assessment, Homework."
    )
    response = await call_ai(
        "You are a Pakistani school teacher. Create detailed lesson plans with: "
        "Learning Objectives, Materials Needed, Introduction (5 min), Main Activity (30 min), "
        "Assessment (5 min), Homework. Format with clear sections.",
        prompt
    )
    return {"response": response, "model": "Llama 3.3 70B"}

# ── 4. Plagiarism Checker ──────────────────────────────────────
@router.post("/plagiarism-check")
async def plagiarism_check(
    req: PlagiarismRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    word_count = len(req.text.split())
    prompt = (
        f"Analyze this student submission for potential plagiarism and AI-generated content.\n"
        f"Assignment: {req.assignment_title}\n"
        f"Word count: {word_count}\n"
        f"Text: {req.text[:2000]}\n\n"
        f"Analyze: 1) Writing style consistency (does it sound like a student?), "
        f"2) Vocabulary sophistication (age-appropriate?), "
        f"3) Structural patterns suggesting copy-paste, "
        f"4) Signs of AI generation, "
        f"5) Overall plagiarism risk: LOW/MEDIUM/HIGH with reasoning, "
        f"6) Recommendation for teacher."
    )
    response = await call_ai(
        "You are a plagiarism detection expert for Pakistani schools. Be thorough but fair.",
        prompt,
        1200
    )
    return {"response": response, "word_count": word_count, "model": "Llama 3.3 70B"}

# ── 5. Feedback Writer ─────────────────────────────────────────
@router.post("/feedback-writer")
async def feedback_writer(
    req: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    pct = round(req.marks_obtained / req.max_marks * 100, 1) if req.max_marks else 0
    title = f"Assignment: {req.assignment_title}\n" if req.assignment_title else ""
    prompt = (
        f"Write constructive feedback for a student who scored "
        f"{req.marks_obtained}/{req.max_marks} ({pct}%) in {req.subject}.\n"
        f"{title}"
        f"Their submission:\n\n{req.submission_text[:2000]}\n\n"
        f"Be encouraging, specific, and suggest clear improvements. "
        f"Keep it suitable for a Pakistani school context."
    )
    response = await call_ai(
        "You are an experienced Pakistani school teacher writing student feedback. "
        "Be honest, encouraging, and specific.",
        prompt,
        1000
    )
    return {"response": response, "percentage": pct, "model": "Llama 3.3 70B"}

# ── 6. Notes Summariser ────────────────────────────────────────
@router.post("/summarise")
async def summarise_notes(
    req: SummariseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ctx = f" Subject: {req.subject}." if req.subject else ""
    prompt = (
        f"Summarise these study notes into key points.{ctx}\n"
        f"Format as:\n"
        f"## Summary\n(2-3 sentences)\n\n"
        f"## Key Points\n(bullet list)\n\n"
        f"## Key Terms\n(glossary with definitions)\n\n"
        f"Notes:\n{req.text[:4000]}"
    )
    response = await call_ai(
        "You are a study assistant for Pakistani school students. "
        "Summarise notes clearly and concisely.",
        prompt,
        1500
    )
    return {"response": response, "model": "Llama 3.3 70B"}

# ── 7. Flashcard Generator ─────────────────────────────────────
@router.post("/flashcards")
async def generate_flashcards(
    req: FlashcardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ctx = f" Subject: {req.subject}." if req.subject else ""
    prompt = (
        f"Generate {req.num_cards} flashcards from these notes.{ctx}\n"
        f"Return ONLY a JSON array, no extra text, no markdown:\n"
        f'[{{"question": "...", "answer": "..."}}, ...]\n\n'
        f"Notes:\n{req.text[:4000]}"
    )
    response = await call_ai(
        "You are a study assistant. Generate flashcards as a raw JSON array only. "
        "No preamble, no markdown, just the JSON.",
        prompt,
        1500
    )
    return {"flashcards": response, "model": "Llama 3.3 70B"}

# ── 8. Rubric Generator ────────────────────────────────────────
@router.post("/rubric-generator")
async def rubric_generator(
    req: RubricRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher_only(current_user)
    desc = f"\nDescription: {req.description}" if req.description else ""
    prompt = (
        f"Create a marking rubric for '{req.assignment_title}' in {req.subject}.{desc}\n"
        f"Total marks: {req.max_marks}\n"
        f"Include: criteria, performance levels (Excellent/Good/Satisfactory/Needs Improvement), "
        f"and marks per criterion. Format as a clear table."
    )
    response = await call_ai(
        "You are an experienced Pakistani school teacher creating assignment rubrics. "
        "Be specific and practical.",
        prompt,
        1200
    )
    return {"response": response, "model": "Llama 3.3 70B"}

# ── 9. Study Plan Generator ────────────────────────────────────
@router.post("/study-plan")
async def study_plan(
    req: StudyPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    exams_str = ', '.join(req.upcoming_exams) if req.upcoming_exams else 'None'
    assign_str = ', '.join(req.upcoming_assignments) if req.upcoming_assignments else 'None'
    prompt = (
        f"Create a {req.days_available}-day study plan for a student with these deadlines:\n"
        f"Upcoming exams: {exams_str}\n"
        f"Upcoming assignments: {assign_str}\n"
        f"Allocate study sessions per day, prioritise by deadline and difficulty. "
        f"Keep it realistic for a Pakistani school student."
    )
    response = await call_ai(
        "You are a study coach for Pakistani school students. "
        "Create practical, achievable study plans.",
        prompt,
        1200
    )
    return {"response": response, "model": "Llama 3.3 70B"}

class ChatRequest(BaseModel):
    message: str
    school_context: Optional[str] = None

@router.post("/chatbot")
async def chatbot(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    context = req.school_context or ""
    system = (
        f"You are Nyxion AI, a helpful assistant for Pakistani school students and teachers. "
        f"You help with studying, assignments, exam prep, and school-related questions. "
        f"User context: {context}. Be concise, friendly, and practical."
    )
    response = await call_ai(system, req.message, 800)
    return {"response": response, "model": "Llama 3.3 70B"}
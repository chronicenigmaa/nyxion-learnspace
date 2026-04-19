import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Boolean, DateTime, ForeignKey, Integer, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class Role(str, enum.Enum):
    super_admin = "super_admin"
    school_admin = "school_admin"
    teacher = "teacher"
    student = "student"


class AssignmentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class SubmissionStatus(str, enum.Enum):
    not_submitted = "not_submitted"
    submitted = "submitted"
    late = "late"
    graded = "graded"


class ExamStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(Role), default=Role.student)
    school_id = Column(String, nullable=True)
    subject = Column(String, nullable=True)  # for teachers
    class_name = Column(String, nullable=True)  # for students
    roll_number = Column(String, nullable=True)
    avatar_color = Column(String, default="#6366f1")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignments_created = relationship("Assignment", back_populates="teacher")
    submissions = relationship("Submission", back_populates="student")
    attendance_records = relationship("Attendance", back_populates="student")


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text)
    subject = Column(String)
    class_name = Column(String)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    due_date = Column(DateTime, nullable=False)
    max_marks = Column(Float, default=100)
    status = Column(SAEnum(AssignmentStatus), default=AssignmentStatus.draft)
    allow_late = Column(Boolean, default=False)
    attachments = Column(JSON, default=[])  # list of file paths
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", back_populates="assignments_created")
    submissions = relationship("Submission", back_populates="assignment")


class Submission(Base):
    __tablename__ = "submissions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    content = Column(Text)
    files = Column(JSON, default=[])  # list of uploaded file paths
    status = Column(SAEnum(SubmissionStatus), default=SubmissionStatus.not_submitted)
    submitted_at = Column(DateTime, nullable=True)
    marks_obtained = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    plagiarism_score = Column(Float, nullable=True)  # 0-100
    plagiarism_report = Column(JSON, nullable=True)
    graded_at = Column(DateTime, nullable=True)
    graded_by = Column(UUID(as_uuid=True), nullable=True)

    assignment = relationship("Assignment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")


class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    class_name = Column(String)
    subject = Column(String, nullable=True)
    date = Column(String)  # YYYY-MM-DD
    is_present = Column(Boolean, default=True)
    marked_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="attendance_records")


class Exam(Base):
    __tablename__ = "exams"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    subject = Column(String)
    class_name = Column(String)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    duration_minutes = Column(Integer, default=60)
    total_marks = Column(Float, default=100)
    scheduled_at = Column(DateTime)
    status = Column(SAEnum(ExamStatus), default=ExamStatus.scheduled)
    questions = Column(JSON, default=[])  # list of question objects
    # Exam restrictions
    restrict_tab_switch = Column(Boolean, default=True)
    restrict_copy_paste = Column(Boolean, default=True)
    restrict_right_click = Column(Boolean, default=True)
    fullscreen_required = Column(Boolean, default=True)
    max_tab_warnings = Column(Integer, default=3)
    shuffle_questions = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User")
    attempts = relationship("ExamAttempt", back_populates="exam")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"))
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    answers = Column(JSON, default={})
    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    score = Column(Float, nullable=True)
    tab_switch_count = Column(Integer, default=0)
    violations = Column(JSON, default=[])  # log of violations
    is_terminated = Column(Boolean, default=False)
    termination_reason = Column(String, nullable=True)

    exam = relationship("Exam", back_populates="attempts")
    student = relationship("User")


class Note(Base):
    __tablename__ = "notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text)
    subject = Column(String)
    class_name = Column(String)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    files = Column(JSON, default=[])  # list of file paths/names
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User")


class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String, default="event")  # holiday, exam, event, announcement, deadline
    date = Column(String, nullable=False)   # YYYY-MM-DD
    end_date = Column(String, nullable=True)
    color = Column(String, default="#6366f1")
    all_day = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

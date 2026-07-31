-- ════════════════════════════════════════════════════════════════════════
-- Nyxion LearnSpace — full schema for Supabase
--
-- Paste this whole file into  Supabase Dashboard → SQL Editor → New query
-- and press Run. Safe to run more than once.
--
-- Creates the `learnspace` schema, 4 enum types and 11 tables.
-- LearnSpace lives here so it cannot collide with EduOS, which uses its own
-- schema against the same database (DB_SCHEMA=eduos).
--
-- After running, switch the Tables page's "schema" dropdown from
-- `public` to `learnspace` to see them.
-- ════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS learnspace;

-- ── Enum types ─────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE learnspace.role AS ENUM ('super_admin', 'school_admin', 'teacher', 'student', 'parent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;   -- role

DO $$ BEGIN
    CREATE TYPE learnspace.assignmentstatus AS ENUM ('draft', 'published', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;   -- assignmentstatus

DO $$ BEGIN
    CREATE TYPE learnspace.submissionstatus AS ENUM ('not_submitted', 'submitted', 'late', 'graded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;   -- submissionstatus

DO $$ BEGIN
    CREATE TYPE learnspace.examstatus AS ENUM ('scheduled', 'live', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;   -- examstatus

-- ── Tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learnspace.users (
    id UUID NOT NULL, 
    name VARCHAR NOT NULL, 
    email VARCHAR NOT NULL, 
    password_hash VARCHAR NOT NULL, 
    role learnspace.role, 
    school_id VARCHAR, 
    subject VARCHAR, 
    class_name VARCHAR, 
    roll_number VARCHAR, 
    avatar_color VARCHAR, 
    is_active BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS learnspace.events (
    id UUID NOT NULL, 
    title VARCHAR NOT NULL, 
    description TEXT, 
    event_type VARCHAR, 
    date VARCHAR NOT NULL, 
    end_date VARCHAR, 
    color VARCHAR, 
    all_day BOOLEAN, 
    created_by UUID, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS learnspace.timetable (
    id UUID NOT NULL, 
    day VARCHAR NOT NULL, 
    period VARCHAR NOT NULL, 
    subject VARCHAR NOT NULL, 
    teacher_name VARCHAR, 
    class_name VARCHAR NOT NULL, 
    start_time VARCHAR, 
    end_time VARCHAR, 
    school_id VARCHAR, 
    created_by UUID, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS learnspace.coursebooks (
    id UUID NOT NULL, 
    title VARCHAR NOT NULL, 
    subject VARCHAR, 
    class_name VARCHAR, 
    description TEXT, 
    file_path VARCHAR, 
    file_name VARCHAR, 
    uploaded_by VARCHAR, 
    school_id VARCHAR, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS learnspace.parent_children (
    id UUID NOT NULL, 
    parent_id UUID NOT NULL, 
    student_id UUID NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 CONSTRAINT uq_parent_student UNIQUE (parent_id, student_id), 
 FOREIGN KEY(parent_id) REFERENCES learnspace.users (id), 
 FOREIGN KEY(student_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.assignments (
    id UUID NOT NULL, 
    title VARCHAR NOT NULL, 
    description TEXT, 
    subject VARCHAR, 
    class_name VARCHAR, 
    teacher_id UUID, 
    due_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    max_marks FLOAT, 
    status learnspace.assignmentstatus, 
    allow_late BOOLEAN, 
    attachments JSON, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 FOREIGN KEY(teacher_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.attendance (
    id UUID NOT NULL, 
    student_id UUID, 
    class_name VARCHAR, 
    subject VARCHAR, 
    date VARCHAR, 
    is_present BOOLEAN, 
    marked_by UUID, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 FOREIGN KEY(student_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.exams (
    id UUID NOT NULL, 
    title VARCHAR NOT NULL, 
    subject VARCHAR, 
    class_name VARCHAR, 
    teacher_id UUID, 
    duration_minutes INTEGER, 
    total_marks FLOAT, 
    scheduled_at TIMESTAMP WITHOUT TIME ZONE, 
    status learnspace.examstatus, 
    questions JSON, 
    restrict_tab_switch BOOLEAN, 
    restrict_copy_paste BOOLEAN, 
    restrict_right_click BOOLEAN, 
    fullscreen_required BOOLEAN, 
    max_tab_warnings INTEGER, 
    shuffle_questions BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 FOREIGN KEY(teacher_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.notes (
    id UUID NOT NULL, 
    title VARCHAR NOT NULL, 
    description TEXT, 
    subject VARCHAR, 
    class_name VARCHAR, 
    teacher_id UUID, 
    files JSON, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
 PRIMARY KEY (id), 
 FOREIGN KEY(teacher_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.submissions (
    id UUID NOT NULL, 
    assignment_id UUID, 
    student_id UUID, 
    content TEXT, 
    files JSON, 
    status learnspace.submissionstatus, 
    submitted_at TIMESTAMP WITHOUT TIME ZONE, 
    marks_obtained FLOAT, 
    feedback TEXT, 
    plagiarism_score FLOAT, 
    plagiarism_report JSON, 
    graded_at TIMESTAMP WITHOUT TIME ZONE, 
    graded_by UUID, 
 PRIMARY KEY (id), 
 FOREIGN KEY(assignment_id) REFERENCES learnspace.assignments (id), 
 FOREIGN KEY(student_id) REFERENCES learnspace.users (id)
);

CREATE TABLE IF NOT EXISTS learnspace.exam_attempts (
    id UUID NOT NULL, 
    exam_id UUID, 
    student_id UUID, 
    answers JSON, 
    started_at TIMESTAMP WITHOUT TIME ZONE, 
    submitted_at TIMESTAMP WITHOUT TIME ZONE, 
    score FLOAT, 
    tab_switch_count INTEGER, 
    violations JSON, 
    is_terminated BOOLEAN, 
    termination_reason VARCHAR, 
 PRIMARY KEY (id), 
 FOREIGN KEY(exam_id) REFERENCES learnspace.exams (id), 
 FOREIGN KEY(student_id) REFERENCES learnspace.users (id)
);

-- ── First super admin ──────────────────────────────────────────────────
-- Password is bcrypt-hashed below; the plaintext is printed in the chat.
-- CHANGE THE EMAIL to your own before running, then change the password
-- from inside the app once you have signed in.

INSERT INTO learnspace.users (id, name, email, password_hash, role, avatar_color, is_active, created_at)
VALUES (
    gen_random_uuid(),
    'Super Admin',
    'it.ai@childlifefoundation.org',
    '$2b$12$0p91Yewg/lEK2WcBDoJrMe1JuudmPeLUavYhD7VNKY4D/gAmw1Psu',
    'super_admin',
    '#4f46e5',
    true,
    now()
)
ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        role          = 'super_admin',
        is_active     = true;

-- Verify
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'learnspace' ORDER BY table_name;
SELECT name, email, role, is_active FROM learnspace.users;

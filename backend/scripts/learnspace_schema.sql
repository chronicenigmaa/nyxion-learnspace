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

-- ── Seed accounts ──────────────────────────────────────────────────────
-- One account per role so every permission level can be exercised.
-- Emails use the reserved .test TLD, which can never resolve, so a stray
-- password-reset email cannot reach a real person.
--
-- CHANGE the super admin's email to a real address you control before you
-- rely on password reset, and delete the rest before going live.

INSERT INTO learnspace.users
    (id, name, email, password_hash, role, school_id, subject, class_name, roll_number, avatar_color, is_active, created_at)
VALUES
    ('04e673be-3cba-40c6-9bfb-676e207d79d2'::uuid, 'Super Admin', 'superadmin@nyxion.test', '$2b$12$qiM0.i5BRkdFn2c5ybTwgeYEZ7avQgFfOFDE1JP2JsiDPxhPWSV6y', 'super_admin', NULL, NULL, NULL, NULL, '#4f46e5', true, now()),
    ('09d7954c-c58f-4d1a-a987-739738905546'::uuid, 'School Admin', 'schooladmin@nyxion.test', '$2b$12$EbAgVjj0FucxUARwbPHLVOhx8hFGNh/hOj4ecdHqf06E7nplcUU02', 'school_admin', 'SCH-001', NULL, NULL, NULL, '#d97706', true, now()),
    ('005f3430-b088-4636-ae60-25d2de66fc7b'::uuid, 'Fatima Malik', 'fatima@nyxion.test', '$2b$12$RF3q5c832.09niqQgUtjluiGKnz4DXndBSh5MJz9zuMOyQ8yQAIb.', 'teacher', 'SCH-001', 'Mathematics', NULL, NULL, '#4f46e5', true, now()),
    ('f66712c2-33ff-42e5-9083-12d080e2103a'::uuid, 'Usman Tariq', 'usman@nyxion.test', '$2b$12$44d5t9llhuEYH9gYkOJbluW7/CtA3paLkfHY8yZv5OIiafEJQZhri', 'teacher', 'SCH-001', 'Physics', NULL, NULL, '#0891b2', true, now()),
    ('035ff6f1-bcc8-47a5-87bc-09e526f47b2a'::uuid, 'Ayesha Siddiqui', 'ayesha@nyxion.test', '$2b$12$PgtYCdUmcSjhjc3R3p7/ZuBe5ZkIePpGCAyhnXd4y07txOx19LJOW', 'teacher', 'SCH-001', 'English', NULL, NULL, '#7c3aed', true, now()),
    ('7ad41ca2-7064-4160-b55f-42e8c5fd2f0b'::uuid, 'Ahmed Khan', 'ahmed@nyxion.test', '$2b$12$RMxgd9lAGfUmhk1.t69B..iR4f8LCgFMQQ78znlwz4GfsgrZ1LUzq', 'student', 'SCH-001', NULL, 'Class 9A', '09A-001', '#059669', true, now()),
    ('7f0db80c-8ba8-4015-b93d-da5e02c228e7'::uuid, 'Sara Malik', 'sara@nyxion.test', '$2b$12$vqMQUPhdGPCc76rCV2tt1..7ASdvop5lHlSdOVwQ3k0JPvjqbEv7S', 'student', 'SCH-001', NULL, 'Class 9A', '09A-002', '#059669', true, now()),
    ('5fa258e5-1191-4461-aae8-b83717b9d08a'::uuid, 'Imran Butt', 'imran@nyxion.test', '$2b$12$MrzXMFKw79iuWu3Mw0kzNejGru2/S86ap7IjAnUH14oTR2dQhTlW6', 'student', 'SCH-001', NULL, 'Class 10A', '10A-001', '#059669', true, now()),
    ('20ba60c5-99eb-4253-9754-87453b9f6b40'::uuid, 'Rabia Noor', 'rabia@nyxion.test', '$2b$12$rawCDmyiKzb.1lBLkVXMxehrDgywtRqTsHQdFmuuX4iXJjOm0O1a.', 'student', 'SCH-001', NULL, 'Class 10A', '10A-002', '#059669', true, now()),
    ('f017aa31-faf6-400e-a02b-41ba7e35ebc9'::uuid, 'Parent of Ahmed', 'parent1@nyxion.test', '$2b$12$lX3GCL.NCBMTrULZMJC4Ruw0ZAlfS.8dxRmRJxmxwe7vHtD4mBtH.', 'parent', 'SCH-001', NULL, NULL, NULL, '#db2777', true, now()),
    ('47d7e572-2458-4d2b-a18f-19896ed37ff2'::uuid, 'Parent of Imran', 'parent2@nyxion.test', '$2b$12$d6HYrvJMN5XBJS6fNYEC8em8CYDJUb2roeW3ET41BwsdGJ4FQG97G', 'parent', 'SCH-001', NULL, NULL, NULL, '#db2777', true, now())
ON CONFLICT (email) DO UPDATE
    SET name          = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role          = EXCLUDED.role,
        school_id     = EXCLUDED.school_id,
        subject       = EXCLUDED.subject,
        class_name    = EXCLUDED.class_name,
        roll_number   = EXCLUDED.roll_number,
        is_active     = true;

-- ── Parent → child links ───────────────────────────────────────────────
-- Parents can ONLY see children linked here; there is no name/email matching.

INSERT INTO learnspace.parent_children (id, parent_id, student_id, created_at)
VALUES
    (gen_random_uuid(), 'f017aa31-faf6-400e-a02b-41ba7e35ebc9'::uuid, '7ad41ca2-7064-4160-b55f-42e8c5fd2f0b'::uuid, now()),
    (gen_random_uuid(), '47d7e572-2458-4d2b-a18f-19896ed37ff2'::uuid, '5fa258e5-1191-4461-aae8-b83717b9d08a'::uuid, now()),
    (gen_random_uuid(), '47d7e572-2458-4d2b-a18f-19896ed37ff2'::uuid, '20ba60c5-99eb-4253-9754-87453b9f6b40'::uuid, now())
ON CONFLICT ON CONSTRAINT uq_parent_student DO NOTHING;

-- ── Remove the placeholder account from the earlier version of this file ──
DELETE FROM learnspace.users WHERE email = 'it.ai@childlifefoundation.org';

-- ── Verify ─────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'learnspace' ORDER BY table_name;

SELECT role, name, email, class_name, subject, is_active
  FROM learnspace.users ORDER BY role, name;

SELECT p.name AS parent, s.name AS child, s.class_name
  FROM learnspace.parent_children pc
  JOIN learnspace.users p ON p.id = pc.parent_id
  JOIN learnspace.users s ON s.id = pc.student_id
 ORDER BY p.name;

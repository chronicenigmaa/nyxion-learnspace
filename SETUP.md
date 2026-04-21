# Nyxion LearnSpace — Complete Setup Guide
## Free Deployment: GitHub + Railway + Vercel

---

## What You're Setting Up

| Layer | Tech | Host | Cost |
|---|---|---|---|
| Database | PostgreSQL | Railway | Free |
| Backend API | FastAPI (Python) | Railway | Free |
| Frontend | Next.js (React) | Vercel | Free |
| Code + CI/CD | Git | GitHub | Free |

Total monthly cost: **PKR 0**

---

## Part 1 — GitHub (5 minutes)

### Step 1.1 — Create repository

1. Go to **github.com** → Sign in
2. Click **New repository** (green button)
3. Name it: `nyxion-learnspace`
4. Set to **Private**
5. Click **Create repository**

### Step 1.2 — Push the code

Open your terminal in the `learnspace` folder:

```bash
git init
git add .
git commit -m "Initial: Nyxion LearnSpace"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nyxion-learnspace.git
git push -u origin main
```

---

## Part 2 — Railway Backend + Database (10 minutes)

### Step 2.1 — Create Railway account

1. Go to **railway.app**
2. Sign up with GitHub (recommended — links automatically)

### Step 2.2 — Create new project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose `nyxion-learnspace`
4. When prompted for the root directory, type: `backend`
5. Railway will detect the Dockerfile automatically

### Step 2.3 — Add PostgreSQL database

In your Railway project:
1. Click **+ New** → **Database** → **Add PostgreSQL**
2. Railway creates the database and gives you a `DATABASE_URL`

### Step 2.4 — Set environment variables

Click your **backend service** → **Variables** tab → Add these:

```
DATABASE_URL        = (Railway fills this automatically from the Postgres addon)
SECRET_KEY          = nyxion-learnspace-prod-2024-change-this-to-something-random
PORT                = 8000
```

**Important:** Copy your Railway backend URL (looks like `https://nyxion-learnspace-backend.up.railway.app`) — you need it for Vercel.

### Step 2.5 — Verify backend is live

Visit: `https://YOUR-RAILWAY-URL.up.railway.app/health`

You should see: `{"status": "ok", "service": "Nyxion LearnSpace"}`

### Step 2.6 — Create demo accounts

Run this once to seed demo accounts:

```bash
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/v1/seed/seed-demo
```

Or open the URL in your browser. This creates:
- `teacher@demo.com` / `demo123` (Teacher)
- `student@demo.com` / `demo123` (Student)
- `admin@demo.com` / `demo123` (Admin)
- `admin@alnooracademy.com` / `admin123` (Admin)

---

## Part 3 — Vercel Frontend (5 minutes)

### Step 3.1 — Create Vercel account

1. Go to **vercel.com**
2. Sign up with GitHub

### Step 3.2 — Import project

1. Click **Add New → Project**
2. Select your `nyxion-learnspace` repository
3. **Root Directory:** change to `frontend`
4. Framework: Next.js (auto-detected)

### Step 3.3 — Set environment variable

In the **Environment Variables** section before deploying:

```
NEXT_PUBLIC_API_URL = https://YOUR-RAILWAY-URL.up.railway.app
```

### Step 3.4 — Deploy

Click **Deploy**. Vercel builds and deploys. Takes ~2 minutes.

Your live URL: `https://nyxion-learnspace.vercel.app`

---

## Part 4 — Link to Nyxion EduOS

LearnSpace and EduOS share the same school ecosystem. To link them:

### Option A — Navigation Link (Quick)

In your EduOS frontend, add a button or nav link:

```jsx
<a href="https://nyxion-learnspace.vercel.app" target="_blank">
  Open LearnSpace
</a>
```

### Option B — Shared Authentication (Advanced)

To allow EduOS users to log into LearnSpace without a separate password:

1. In EduOS backend, generate a signed JWT with the same `SECRET_KEY` you used in LearnSpace
2. Pass it as a URL param: `https://nyxion-learnspace.vercel.app/auth/sso?token=TOKEN`
3. LearnSpace reads the token and logs the user in

This requires adding an SSO endpoint to LearnSpace's auth router (ask for this code when ready).

---

## Part 5 — Creating Real Accounts

### Add a teacher account

```bash
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ms. Fatima Malik",
    "email": "fatima@yourschool.com",
    "password": "secure_password_here",
    "role": "teacher",
    "subject": "Mathematics"
  }'
```

### Add a student account

```bash
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmed Khan",
    "email": "ahmed@yourschool.com",
    "password": "student_password",
    "role": "student",
    "class_name": "Class 9A",
    "roll_number": "09A-001"
  }'
```

Or build an admin page in LearnSpace that calls these endpoints (ask for this when ready).

---

## Part 6 — Future Deployments

Every time you make a change:

```bash
git add .
git commit -m "your description"
git push
```

- GitHub Actions runs checks automatically
- Railway redeploys the backend
- Vercel redeploys the frontend

---

## Feature Summary

### Teacher Portal
| Feature | How to use |
|---|---|
| Create Assignment | Dashboard → Assignments → New Assignment |
| Upload Notes/Slides | Dashboard → Notes & Slides → Upload Notes |
| Schedule Exam | Dashboard → Exams → Schedule Exam |
| Go Live on Exam | Dashboard → Exams → Go Live button |
| Grade Submissions | Dashboard → Assignments → [Assignment] → Grade |
| Mark Attendance | Dashboard → Attendance → Mark Attendance |
| View Reports | Dashboard → Attendance → View Report |

### Student Portal
| Feature | How to use |
|---|---|
| View Assignments | Dashboard → Assignments |
| Submit Assignment | Dashboard → Assignments → [Assignment] → Submit |
| Download Notes | Dashboard → Notes & Slides → Download |
| Join Live Exam | Dashboard → Exams → Enter Exam |
| View Grades | Dashboard → Grades |
| Check Attendance | Dashboard → My Attendance |

### Live Exam Security
- Tab switching is detected and logged
- Students get N warnings (configurable) before auto-termination
- Fullscreen is enforced
- Copy/paste is disabled
- Right-click is blocked
- Questions can be shuffled per student
- MCQs are auto-graded instantly
- Essay questions go to teacher for manual grading

### Plagiarism Detection
- Every text submission is checked against all other submissions for the same assignment
- Similarity score 0–100% shown on each submission
- Flagged (>60% match) submissions are highlighted in red
- Teacher sees match details per submission

---

## Troubleshooting

**Backend won't start:**
- Check Railway logs (Deployments tab)
- Verify `DATABASE_URL` variable is set
- PostgreSQL service must be added before backend deploys

**Frontend shows blank page:**
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel and does NOT have a trailing slash
- Check browser console for CORS errors

**Login not working:**
- Confirm backend `/health` endpoint responds
- Run the seed-demo endpoint again
- Check the Railway logs for auth errors

**File uploads failing:**
- Railway free tier has ephemeral storage (files disappear on redeploy)
- For persistent file storage, add Cloudinary or AWS S3 (ask for this integration)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    NYXION LEARNSPACE                     │
├─────────────────┬───────────────────┬───────────────────┤
│   STUDENT       │    TEACHER        │     ADMIN         │
│   PORTAL        │    PORTAL         │     PORTAL        │
│                 │                   │                   │
│ • View assign.  │ • Create assign.  │ • All features    │
│ • Submit work   │ • Upload notes    │ • Manage users    │
│ • Join exams    │ • Schedule exams  │ • View reports    │
│ • View grades   │ • Grade work      │                   │
│ • Attendance    │ • Mark attendance │                   │
└────────┬────────┴────────┬──────────┴────────┬──────────┘
         │                 │                   │
         └─────────────────┼───────────────────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │  VERCEL     │
                    │  (Next.js)  │
                    └──────┬──────┘
                           │ API calls
                    ┌──────▼──────┐
                    │  RAILWAY    │
                    │  (FastAPI)  │
                    └──────┬──────┘
                           │ SQL
                    ┌──────▼──────┐
                    │  RAILWAY    │
                    │ (PostgreSQL)│
                    └─────────────┘
```

---

## Contact

Nyxion Labs · hello@nyxionlabs.com · nyxion-labs.vercel.app

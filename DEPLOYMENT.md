# Nyxion LearnSpace — Production Setup

## 0. Sharing one Supabase project with EduOS

LearnSpace and EduOS run against the **same** Supabase project. Both products
define tables called `users`, `events` and others, so each one keeps its tables
in its own Postgres schema and they never collide:

```
Supabase project
├── public.app_logs        ← shared; both products write here (service column)
├── learnspace.*           ← this app's 11 tables   (DB_SCHEMA=learnspace)
└── eduos.*                ← EduOS's tables         (DB_SCHEMA=eduos)
```

Set `DB_SCHEMA=learnspace` here and `DB_SCHEMA=eduos` on the EduOS backend.
Both use the identical `DATABASE_URL`. The schema is created automatically on
boot if missing — nothing to do by hand.

Create the shared log table once by running
[backend/scripts/shared_app_logs.sql](backend/scripts/shared_app_logs.sql) in
the Supabase SQL Editor.

> Two products in one project share a connection limit and a backup schedule,
> and resetting the database password breaks both at once. That's the tradeoff
> against the simpler billing and single dashboard.

## 1. Create the database schema on Supabase

Get the connection string from **Supabase → Project Settings → Database →
Connection string → URI** (prefer the *Session pooler*, port 5432).

```bash
cd backend
pip install -r requirements.txt

export DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"

python scripts/init_db.py \
  --super-admin-email you@school.com \
  --super-admin-name  "Your Name" \
  --super-admin-password 'a-strong-password'
```

This creates all 11 tables and your first super admin. It is idempotent — run
it again any time; existing tables and accounts are left in place.

Add `--demo` to also create the demo logins
(`admin@demo.com` / `teacher@demo.com` / `student@demo.com` / `parent@demo.com`,
all with password `demo123`). **Do not use `--demo` on a real school's
database** — those passwords are public knowledge.

The backend also calls `Base.metadata.create_all()` on boot, so tables appear
automatically on first deploy; the script exists so you can create accounts and
verify the schema without hitting the API.

## 2. Set backend environment variables

Copy [backend/.env.example](backend/.env.example) and fill it in. The four that
matter most:

| Variable | Why it matters |
|---|---|
| `DATABASE_URL` | Supabase Postgres. Nothing works without it. |
| `SECRET_KEY` | Signs all JWTs. Changing it logs everyone out. |
| `RESEND_API_KEY` | Without it **no password-reset email is sent**. |
| `GROQ_API_KEY` | Without it every AI feature returns 503. |

Set `APP_BASE_URL` to the **frontend** URL — reset links in emails are built
from it.

## 3. Create super admins

**The first one** — set `BOOTSTRAP_SECRET` on the backend, then either:

- visit `/setup` in the browser and enter that secret, or
- run `scripts/init_db.py` as in step 1.

The bootstrap route refuses once any active super admin exists, so a leaked
secret cannot be replayed later. **Remove `BOOTSTRAP_SECRET` after first login.**

**Every one after that** — sign in as a super admin and go to
**Users → Administrators → New super admin**. You can either type a password or
let the server generate a strong one and email it. From there you can also
enable/disable and delete admin accounts. The last active super admin cannot be
disabled or deleted, and you cannot disable or delete yourself.

## 4. Password reset

`/auth/forgot-password` → emails a reset link (valid 1 hour) →
`/auth/reset-password?token=...` → new password set.

The endpoint replies identically whether or not the address exists, so it can't
be used to discover which emails are registered.

If `RESEND_API_KEY` is unset the email silently doesn't send and the flow dead-ends.
For local development only, set `ALLOW_RESET_TOKEN_IN_RESPONSE=true` to have the
token returned in the response and reset inline instead. Never set this in
production — it makes password reset a one-request account takeover.

### Resend setup

1. Sign up at [resend.com](https://resend.com), create an API key.
2. Add and verify your sending domain (Domains → Add Domain → add the DNS records).
3. Set `MAIL_FROM="Nyxion LearnSpace <noreply@yourdomain.com>"`.

Until a domain is verified you can use `onboarding@resend.dev`, but it only
delivers to the address that owns the Resend account — fine for testing, not for
real users.

## 5. Frontend

Set `NEXT_PUBLIC_API_URL` to the backend's public URL, then `npm run build`.

## Security changes made for production

Four issues were fixed before this was production-ready:

1. **`POST /auth/register` was open and accepted any `role`** — anyone could
   register themselves as `super_admin`. Now admin-only, and it cannot create
   super admins at all.
2. **`POST /seed/seed-demo` was open** — anyone could create `admin@demo.com`
   with the published password `demo123` and a `school_admin` role. Now requires
   a super admin *and* `ALLOW_DEMO_SEED=true`.
3. **Password-reset tokens worked as full API access tokens** — an emailed reset
   link granted an hour of complete API access. Single-purpose tokens are now
   rejected as session credentials.
4. **`/forgot-password` returned the reset token in its response** — anyone could
   request a reset for any address and take the account over. Now emailed only.

Disabled accounts are also rejected on every request, not just at login.

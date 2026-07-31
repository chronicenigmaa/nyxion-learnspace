-- Shared structured-log table for BOTH LearnSpace and EduOS.
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- This lives in `public`, not in a per-product schema, for two reasons:
--   1. app/core/logging_client.py writes it over Supabase's REST API (PostgREST),
--      which only exposes `public` unless you add a schema under
--      Project Settings → API → Exposed schemas.
--   2. Both products write here; the `service` column tells them apart.

create table if not exists public.app_logs (
    id           bigserial primary key,
    ts           timestamptz not null default now(),
    service      text        not null,          -- 'learnspace' | 'eduos'
    level        text        not null,          -- info | warning | error
    event        text        not null,          -- e.g. auth.login, admin.bootstrapped
    user_id      uuid,
    role         text,
    method       text,
    path         text,
    status_code  integer,
    duration_ms  integer,
    ip           text,
    detail       jsonb
);

create index if not exists app_logs_ts_idx        on public.app_logs (ts desc);
create index if not exists app_logs_service_idx   on public.app_logs (service, ts desc);
create index if not exists app_logs_event_idx     on public.app_logs (event, ts desc);
create index if not exists app_logs_level_idx     on public.app_logs (level, ts desc)
    where level in ('warning', 'error');

-- Lock the table down. The backends write with the service_role key, which
-- bypasses RLS; enabling RLS with no permissive policy means anon/authenticated
-- clients (i.e. anyone holding the public anon key) can neither read nor write.
alter table public.app_logs enable row level security;

-- Optional retention: drop log lines older than 90 days.
-- Schedule with pg_cron if the extension is enabled on your project.
--   select cron.schedule('purge-app-logs', '0 3 * * *',
--     $$delete from public.app_logs where ts < now() - interval '90 days'$$);

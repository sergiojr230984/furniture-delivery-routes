-- =====================================================================
-- Status audit trail, crew job evidence, and recipient tracking links.
-- =====================================================================
create table if not exists public.status_events (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  from_status    text,
  to_status      text not null,
  actor_user_id  uuid references public.users(id) on delete set null,
  actor_label    text, -- e.g. "System", "Provider: Sunshine Movers" for non-logged-in-context events
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_status_events_booking on public.status_events(booking_id, created_at);

-- Custody/evidence captured by the crew mobile job screen.
create table if not exists public.job_evidence (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  pickup_id      uuid references public.booking_pickups(id),
  stage          text not null, -- pickup_condition | pickup_collected | delivery_completed | assembly | issue
  kind           text not null, -- photo | signature | checklist | note
  file_path      text,
  meta           jsonb not null default '{}'::jsonb,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_job_evidence_booking on public.job_evidence(booking_id);
create index if not exists idx_job_evidence_assignment on public.job_evidence(assignment_id);

-- Secure, expiring recipient tracking links (no account required).
create table if not exists public.tracking_tokens (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_tracking_tokens_booking on public.tracking_tokens(booking_id);

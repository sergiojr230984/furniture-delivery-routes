-- =====================================================================
-- Provider/crew ratings: the retailer who booked a delivery rates it
-- (1-5 stars + optional comment) once the job reaches a terminal state.
-- The core trust signal in a two-sided marketplace — surfaced on the
-- provider's own dashboard and to dispatch/admin when deciding who to
-- route jobs to.
-- =====================================================================
create table if not exists public.assignment_ratings (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null unique references public.assignments(id) on delete cascade,
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  provider_org_id uuid not null references public.organizations(id) on delete cascade,
  rating          int not null check (rating between 1 and 5),
  comment         text,
  rated_by        uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_assignment_ratings_provider on public.assignment_ratings(provider_org_id);
create index if not exists idx_assignment_ratings_booking on public.assignment_ratings(booking_id);

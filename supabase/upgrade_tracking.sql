-- =====================================================================
--  Driver live-location upgrade
--  Stores each driver's latest GPS position (one row per driver, updated
--  in place) so dispatchers can track crews in real time.
--
--  Idempotent — safe to run on an existing database; also appended to
--  schema.sql for fresh installs.
-- =====================================================================

create table if not exists public.driver_locations (
  driver_id   uuid primary key references public.drivers(id) on delete cascade,
  route_id    uuid references public.routes(id) on delete set null,
  latitude    double precision not null,
  longitude   double precision not null,
  accuracy    numeric,
  heading     numeric,
  speed       numeric,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_driver_locations_updated on public.driver_locations(updated_at);

alter table public.driver_locations enable row level security;

-- Staff can see every crew location; a driver can see their own.
drop policy if exists driver_locations_select on public.driver_locations;
create policy driver_locations_select on public.driver_locations for select
  using (public.is_staff() or driver_id in (select public.my_driver_ids()));

-- Only the driver themselves may push their position (insert + update via upsert).
drop policy if exists driver_locations_write on public.driver_locations;
create policy driver_locations_write on public.driver_locations for all
  using (driver_id in (select public.my_driver_ids()))
  with check (driver_id in (select public.my_driver_ids()));

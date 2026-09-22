-- =====================================================================
-- Capacity, offers, assignments and routes.
--
-- Capacity model (deliberately conservative, not a bin-packing solver):
-- each vehicle has a max_jobs_per_day "slot" budget and a payload_lbs
-- ceiling. Reserving capacity means atomically decrementing the day's
-- remaining slots for that vehicle - a single UPDATE ... WHERE remaining
-- > 0 RETURNING *, which Postgres row-locks, so two concurrent requests
-- can never both win the same last slot. Holds expire (checkout window)
-- and are lazily reclaimed by expire_stale_holds() before every capacity
-- check.
-- =====================================================================
do $$ begin
  create type offer_status as enum ('pending','accepted','declined','expired','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum (
    'assigned','en_route_pickup','arrived_pickup','picked_up',
    'en_route_delivery','arrived_delivery','completed','failed','cancelled'
  );
exception when duplicate_object then null; end $$;

-- One row per (vehicle, day): the remaining conservative job-slot budget.
create table if not exists public.vehicle_day_capacity (
  vehicle_id  uuid not null references public.provider_vehicles(id) on delete cascade,
  day         date not null,
  max_jobs    int not null,
  held_jobs   int not null default 0,
  primary key (vehicle_id, day)
);

create table if not exists public.capacity_holds (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  provider_org_id uuid not null references public.organizations(id),
  vehicle_id     uuid references public.provider_vehicles(id),
  window_date    date not null,
  status         text not null default 'active', -- active | committed | released | expired
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_capacity_holds_booking on public.capacity_holds(booking_id);
create index if not exists idx_capacity_holds_vehicle_day on public.capacity_holds(vehicle_id, window_date);
-- At most one active/committed hold per booking at a time.
create unique index if not exists idx_capacity_holds_one_live
  on public.capacity_holds(booking_id)
  where status in ('active','committed');

-- Releases/expires holds whose checkout window has passed, returning their
-- slot to the vehicle's day budget. Call at the start of any capacity-
-- affecting transaction so reads never see stale holds as "consuming" slots.
create or replace function public.expire_stale_holds()
returns void language plpgsql as $$
declare
  h record;
begin
  for h in
    select * from public.capacity_holds
    where status = 'active' and expires_at < now()
    for update skip locked
  loop
    update public.vehicle_day_capacity
      set held_jobs = greatest(0, held_jobs - 1)
      where vehicle_id = h.vehicle_id and day = h.window_date;
    update public.capacity_holds set status = 'expired' where id = h.id;
  end loop;
end $$;

-- ---- Offers: dispatch's proposal to a provider org for a booking ----------
create table if not exists public.offers (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  provider_org_id uuid not null references public.organizations(id),
  payout_amount   numeric(10,2) not null,
  scope           jsonb not null default '{}'::jsonb, -- approx route, items, stairs, assembly, vehicle req, est minutes
  status          offer_status not null default 'pending',
  expires_at      timestamptz not null,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);

create index if not exists idx_offers_booking on public.offers(booking_id);
create index if not exists idx_offers_provider_status on public.offers(provider_org_id, status);
-- Guard: only one *accepted* offer may ever exist per booking.
create unique index if not exists idx_offers_one_accepted
  on public.offers(booking_id)
  where status = 'accepted';

-- ---- Assignments: the committed pairing of a booking to a provider --------
create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  provider_org_id uuid not null references public.organizations(id),
  vehicle_id      uuid references public.provider_vehicles(id),
  route_id        uuid,
  status          assignment_status not null default 'assigned',
  offer_id        uuid references public.offers(id),
  assigned_by     uuid references public.users(id) on delete set null,
  override_reason text, -- set when dispatch manually assigned/overrode instead of via offer flow
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_assignments_updated on public.assignments;
create trigger trg_assignments_updated before update on public.assignments
  for each row execute function public.set_updated_at();

create index if not exists idx_assignments_provider on public.assignments(provider_org_id);

create table if not exists public.assignment_crew (
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  crew_member_id uuid not null references public.crew_members(id) on delete cascade,
  primary key (assignment_id, crew_member_id)
);

-- ---- Routes: batches of stops for one provider's vehicle on one day -------
create table if not exists public.routes (
  id                 uuid primary key default gen_random_uuid(),
  provider_org_id    uuid not null references public.organizations(id),
  vehicle_id         uuid references public.provider_vehicles(id),
  route_date         date not null,
  status             text not null default 'planning', -- planning | in_progress | completed | cancelled
  total_distance_mi  numeric(7,1),
  total_duration_min int,
  optimized_at       timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.assignments
  add constraint assignments_route_fk foreign key (route_id) references public.routes(id) on delete set null;

create index if not exists idx_routes_provider_date on public.routes(provider_org_id, route_date);

create table if not exists public.route_stops (
  id                    uuid primary key default gen_random_uuid(),
  route_id              uuid not null references public.routes(id) on delete cascade,
  booking_id            uuid not null references public.bookings(id) on delete cascade,
  pickup_id             uuid references public.booking_pickups(id),
  stop_type             text not null, -- 'pickup' | 'delivery'
  sequence              int not null default 0,
  eta                   timestamptz,
  arrived_at            timestamptz,
  completed_at          timestamptz,
  distance_from_prev_mi numeric(6,1),
  predicted_delay_min   int not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists idx_route_stops_route on public.route_stops(route_id);
create index if not exists idx_route_stops_booking on public.route_stops(booking_id);

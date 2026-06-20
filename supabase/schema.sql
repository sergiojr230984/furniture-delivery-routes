-- FleetView — Furniture Delivery & Route Management
-- Run this in the Supabase SQL Editor to set up the database.

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'driver' check (role in ('admin', 'driver')),
  created_at  timestamptz not null default now()
);

create table if not exists drivers (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete set null,
  name           text not null,
  phone          text,
  email          text,
  vehicle_type   text,
  license_plate  text,
  status         text not null default 'active' check (status in ('active', 'inactive')),
  created_at     timestamptz not null default now()
);

create table if not exists routes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        date not null,
  driver_id   uuid references drivers(id) on delete set null,
  status      text not null default 'pending'
                check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists deliveries (
  id                  uuid primary key default gen_random_uuid(),
  route_id            uuid not null references routes(id) on delete cascade,
  customer_name       text not null,
  customer_phone      text,
  address             text not null,
  city                text,
  items_description   text,
  status              text not null default 'pending'
                        check (status in ('pending', 'delivered', 'failed', 'rescheduled')),
  time_window         text,
  sequence_order      integer not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists routes_date_idx on routes(date);
create index if not exists deliveries_route_id_idx on deliveries(route_id);
create index if not exists deliveries_status_idx on deliveries(status);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger routes_updated_at
  before update on routes
  for each row execute function update_updated_at();

create or replace trigger deliveries_updated_at
  before update on deliveries
  for each row execute function update_updated_at();

-- ─── Auto-create profile on sign-up ──────────────────────────────────────────

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table profiles   enable row level security;
alter table drivers    enable row level security;
alter table routes     enable row level security;
alter table deliveries enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
  on profiles for select using (is_admin());

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles"
  on profiles for update using (is_admin());

-- drivers
drop policy if exists "Admins manage drivers" on drivers;
create policy "Admins manage drivers"
  on drivers for all using (is_admin());

drop policy if exists "Drivers can view their own record" on drivers;
create policy "Drivers can view their own record"
  on drivers for select using (
    profile_id = auth.uid()
  );

-- routes
drop policy if exists "Admins manage routes" on routes;
create policy "Admins manage routes"
  on routes for all using (is_admin());

drop policy if exists "Drivers can view their own routes" on routes;
create policy "Drivers can view their own routes"
  on routes for select using (
    driver_id in (
      select id from drivers where profile_id = auth.uid()
    )
  );

-- deliveries
drop policy if exists "Admins manage deliveries" on deliveries;
create policy "Admins manage deliveries"
  on deliveries for all using (is_admin());

drop policy if exists "Drivers can view deliveries on their routes" on deliveries;
create policy "Drivers can view deliveries on their routes"
  on deliveries for select using (
    route_id in (
      select r.id from routes r
      join drivers d on d.id = r.driver_id
      where d.profile_id = auth.uid()
    )
  );

drop policy if exists "Drivers can update delivery status on their routes" on deliveries;
create policy "Drivers can update delivery status on their routes"
  on deliveries for update using (
    route_id in (
      select r.id from routes r
      join drivers d on d.id = r.driver_id
      where d.profile_id = auth.uid()
    )
  );

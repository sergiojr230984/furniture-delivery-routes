-- =====================================================================
--  Furniture Delivery & Route Management — Database Schema
--  Target: Supabase (PostgreSQL)
--
--  Run this in the Supabase SQL editor on a fresh project.
--  It creates enums, tables, triggers, row-level-security policies and
--  the two private storage buckets used for proof-of-delivery.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'manager', 'salesperson', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum (
    'pending', 'scheduled', 'loaded', 'out_for_delivery',
    'delivered', 'failed', 'rescheduled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_type as enum ('delivery', 'pickup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stop_type as enum ('delivery', 'pickup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type route_status as enum ('planning', 'assigned', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_status as enum ('available', 'in_use', 'maintenance', 'out_of_service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type crew_type as enum ('driver', 'helper');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Helper: updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Profiles (one row per auth user) + role helpers
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  role        user_role not null default 'salesperson',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a new auth user signs up.
-- The role can be passed via user metadata (raw_user_meta_data->>'role').
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'salesperson')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
create or replace function public.current_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'manager', 'salesperson'), false);
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'manager'), false);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- 4. Customers
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  notes         text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Vehicles / Vans
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,            -- e.g. "Van 1"
  make            text,
  model           text,
  year            int,
  license_plate   text,
  capacity_volume numeric,                  -- cubic units
  capacity_weight numeric,                  -- weight units
  status          vehicle_status not null default 'available',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_vehicles_updated on public.vehicles;
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Drivers & Helpers (crew)
-- ---------------------------------------------------------------------
create table if not exists public.drivers (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references public.profiles(id) on delete set null, -- links to a login
  full_name      text not null,
  phone          text,
  license_number text,
  crew_type      crew_type not null default 'driver',
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_drivers_updated on public.drivers;
create trigger trg_drivers_updated before update on public.drivers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Delivery Orders
-- ---------------------------------------------------------------------
create sequence if not exists public.delivery_order_seq;

create table if not exists public.delivery_orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text unique,
  order_type         order_type not null default 'delivery',
  customer_id        uuid references public.customers(id),
  status             delivery_status not null default 'pending',
  scheduled_date     date,
  time_window_start  time,
  time_window_end    time,
  -- delivery/pickup address snapshot (can differ from the customer record)
  contact_name       text,
  contact_phone      text,
  address_line1      text,
  address_line2      text,
  city               text,
  state              text,
  postal_code        text,
  priority           int not null default 0,
  salesperson_id     uuid references public.profiles(id),
  notes              text,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_delivery_orders_date on public.delivery_orders(scheduled_date);
create index if not exists idx_delivery_orders_status on public.delivery_orders(status);
create index if not exists idx_delivery_orders_customer on public.delivery_orders(customer_id);

-- Auto-generate a friendly order number: DO-000001
create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'DO-' || lpad(nextval('public.delivery_order_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_order_number on public.delivery_orders;
create trigger trg_order_number before insert on public.delivery_orders
  for each row execute function public.set_order_number();

drop trigger if exists trg_delivery_orders_updated on public.delivery_orders;
create trigger trg_delivery_orders_updated before update on public.delivery_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8. Delivery Items (line items per order)
-- ---------------------------------------------------------------------
create table if not exists public.delivery_items (
  id                uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  description       text not null,
  sku               text,
  quantity          int not null default 1,
  weight            numeric,
  volume            numeric,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_delivery_items_order on public.delivery_items(delivery_order_id);

-- ---------------------------------------------------------------------
-- 9. Routes
-- ---------------------------------------------------------------------
create table if not exists public.routes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  route_date  date not null,
  vehicle_id  uuid references public.vehicles(id),
  driver_id   uuid references public.drivers(id),
  helper_id   uuid references public.drivers(id),
  status      route_status not null default 'planning',
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_routes_date on public.routes(route_date);
create index if not exists idx_routes_driver on public.routes(driver_id);

drop trigger if exists trg_routes_updated on public.routes;
create trigger trg_routes_updated before update on public.routes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 10. Route Stops (ordered deliveries/pickups on a route)
-- ---------------------------------------------------------------------
create table if not exists public.route_stops (
  id                uuid primary key default gen_random_uuid(),
  route_id          uuid not null references public.routes(id) on delete cascade,
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  stop_order        int not null default 0,
  stop_type         stop_type not null default 'delivery',
  arrived_at        timestamptz,
  completed_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  unique (route_id, delivery_order_id)
);

create index if not exists idx_route_stops_route on public.route_stops(route_id);
create index if not exists idx_route_stops_order on public.route_stops(delivery_order_id);

-- ---------------------------------------------------------------------
-- 11. Delivery Photos (proof of delivery)
-- ---------------------------------------------------------------------
create table if not exists public.delivery_photos (
  id                uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  route_stop_id     uuid references public.route_stops(id) on delete set null,
  storage_path      text not null,          -- path inside the 'delivery-photos' bucket
  caption           text,
  uploaded_by       uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_delivery_photos_order on public.delivery_photos(delivery_order_id);

-- ---------------------------------------------------------------------
-- 12. Delivery Signatures
-- ---------------------------------------------------------------------
create table if not exists public.delivery_signatures (
  id                uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  route_stop_id     uuid references public.route_stops(id) on delete set null,
  signer_name       text,
  storage_path      text not null,          -- path inside the 'signatures' bucket
  signed_at         timestamptz not null default now(),
  captured_by       uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_delivery_signatures_order on public.delivery_signatures(delivery_order_id);

-- ---------------------------------------------------------------------
-- 13. Delivery Status History (audit trail)
-- ---------------------------------------------------------------------
create table if not exists public.delivery_status_history (
  id                uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  status            delivery_status not null,
  notes             text,
  changed_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);

create index if not exists idx_status_history_order on public.delivery_status_history(delivery_order_id);

-- Record every status change on a delivery order into the history table.
create or replace function public.log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.delivery_status_history (delivery_order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_log_status_insert on public.delivery_orders;
create trigger trg_log_status_insert after insert on public.delivery_orders
  for each row execute function public.log_status_change();

drop trigger if exists trg_log_status_update on public.delivery_orders;
create trigger trg_log_status_update after update on public.delivery_orders
  for each row execute function public.log_status_change();

-- =====================================================================
-- 14. Row Level Security
-- =====================================================================
alter table public.profiles               enable row level security;
alter table public.customers              enable row level security;
alter table public.vehicles               enable row level security;
alter table public.drivers                enable row level security;
alter table public.delivery_orders        enable row level security;
alter table public.delivery_items         enable row level security;
alter table public.routes                 enable row level security;
alter table public.route_stops            enable row level security;
alter table public.delivery_photos        enable row level security;
alter table public.delivery_signatures    enable row level security;
alter table public.delivery_status_history enable row level security;

-- Convenience: which driver rows belong to the current user
create or replace function public.my_driver_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.drivers where profile_id = auth.uid();
$$;

-- Is the given delivery order on a route assigned to the current driver?
create or replace function public.order_assigned_to_me(p_order uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.route_stops rs
    join public.routes r on r.id = rs.route_id
    where rs.delivery_order_id = p_order
      and (r.driver_id in (select public.my_driver_ids())
           or r.helper_id in (select public.my_driver_ids()))
  );
$$;

-- ---- profiles ----
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert
  with check (public.is_admin());

-- ---- customers (all authenticated users can read; staff manage) ----
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select
  using (auth.uid() is not null);

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- vehicles (all read; managers manage) ----
drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles for select
  using (auth.uid() is not null);

drop policy if exists vehicles_write on public.vehicles;
create policy vehicles_write on public.vehicles for all
  using (public.is_manager()) with check (public.is_manager());

-- ---- drivers (all read; managers manage) ----
drop policy if exists drivers_select on public.drivers;
create policy drivers_select on public.drivers for select
  using (auth.uid() is not null);

drop policy if exists drivers_write on public.drivers;
create policy drivers_write on public.drivers for all
  using (public.is_manager()) with check (public.is_manager());

-- ---- delivery_orders ----
drop policy if exists delivery_orders_select on public.delivery_orders;
create policy delivery_orders_select on public.delivery_orders for select
  using (public.is_staff() or public.order_assigned_to_me(id));

drop policy if exists delivery_orders_staff_write on public.delivery_orders;
create policy delivery_orders_staff_write on public.delivery_orders for all
  using (public.is_staff()) with check (public.is_staff());

-- drivers may update the status of orders assigned to them
drop policy if exists delivery_orders_driver_update on public.delivery_orders;
create policy delivery_orders_driver_update on public.delivery_orders for update
  using (public.order_assigned_to_me(id))
  with check (public.order_assigned_to_me(id));

-- ---- delivery_items ----
drop policy if exists delivery_items_select on public.delivery_items;
create policy delivery_items_select on public.delivery_items for select
  using (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists delivery_items_write on public.delivery_items;
create policy delivery_items_write on public.delivery_items for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- routes ----
drop policy if exists routes_select on public.routes;
create policy routes_select on public.routes for select
  using (public.is_staff()
         or driver_id in (select public.my_driver_ids())
         or helper_id in (select public.my_driver_ids()));

drop policy if exists routes_write on public.routes;
create policy routes_write on public.routes for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- route_stops ----
drop policy if exists route_stops_select on public.route_stops;
create policy route_stops_select on public.route_stops for select
  using (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists route_stops_staff_write on public.route_stops;
create policy route_stops_staff_write on public.route_stops for all
  using (public.is_staff()) with check (public.is_staff());

-- drivers may update stop progress (arrived/completed) for their routes
drop policy if exists route_stops_driver_update on public.route_stops;
create policy route_stops_driver_update on public.route_stops for update
  using (public.order_assigned_to_me(delivery_order_id))
  with check (public.order_assigned_to_me(delivery_order_id));

-- ---- delivery_photos ----
drop policy if exists delivery_photos_select on public.delivery_photos;
create policy delivery_photos_select on public.delivery_photos for select
  using (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists delivery_photos_insert on public.delivery_photos;
create policy delivery_photos_insert on public.delivery_photos for insert
  with check (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists delivery_photos_delete on public.delivery_photos;
create policy delivery_photos_delete on public.delivery_photos for delete
  using (public.is_staff() or uploaded_by = auth.uid());

-- ---- delivery_signatures ----
drop policy if exists delivery_signatures_select on public.delivery_signatures;
create policy delivery_signatures_select on public.delivery_signatures for select
  using (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists delivery_signatures_insert on public.delivery_signatures;
create policy delivery_signatures_insert on public.delivery_signatures for insert
  with check (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

-- ---- delivery_status_history (read-only for users; written by trigger) ----
drop policy if exists status_history_select on public.delivery_status_history;
create policy status_history_select on public.delivery_status_history for select
  using (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

drop policy if exists status_history_insert on public.delivery_status_history;
create policy status_history_insert on public.delivery_status_history for insert
  with check (public.is_staff() or public.order_assigned_to_me(delivery_order_id));

-- =====================================================================
-- 15. Storage buckets for proof-of-delivery (private)
-- =====================================================================
insert into storage.buckets (id, name, public)
  values ('delivery-photos', 'delivery-photos', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('signatures', 'signatures', false)
  on conflict (id) do nothing;

-- Any authenticated user may read/write within these two buckets.
drop policy if exists pod_read on storage.objects;
create policy pod_read on storage.objects for select
  using (bucket_id in ('delivery-photos', 'signatures') and auth.uid() is not null);

drop policy if exists pod_insert on storage.objects;
create policy pod_insert on storage.objects for insert
  with check (bucket_id in ('delivery-photos', 'signatures') and auth.uid() is not null);

drop policy if exists pod_update on storage.objects;
create policy pod_update on storage.objects for update
  using (bucket_id in ('delivery-photos', 'signatures') and auth.uid() is not null);

-- ---- Depot / org settings (single row) ----
create table if not exists public.org_settings (
  id                      int primary key default 1,
  depot_name              text,
  depot_address           text,
  depot_lat               double precision,
  depot_lng               double precision,
  default_service_minutes int not null default 15,
  default_avg_speed_kmh   numeric not null default 40,
  updated_at              timestamptz not null default now(),
  constraint org_settings_singleton check (id = 1)
);

insert into public.org_settings (id) values (1) on conflict (id) do nothing;

-- ---- Delivery zones (custom routing constraint) ----
create table if not exists public.delivery_zones (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  color           text not null default '#2563eb',
  center_lat      double precision,
  center_lng      double precision,
  radius_km       numeric,
  postal_prefixes text[] not null default '{}',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---- delivery_orders: coordinates, on-demand, constraints ----
alter table public.delivery_orders add column if not exists latitude double precision;
alter table public.delivery_orders add column if not exists longitude double precision;
alter table public.delivery_orders add column if not exists on_demand boolean not null default false;
alter table public.delivery_orders add column if not exists service_minutes int;
alter table public.delivery_orders add column if not exists zone_id uuid references public.delivery_zones(id) on delete set null;
alter table public.delivery_orders add column if not exists sla_deadline timestamptz;

create index if not exists idx_delivery_orders_zone on public.delivery_orders(zone_id);
create index if not exists idx_delivery_orders_ondemand on public.delivery_orders(on_demand);

-- ---- vehicles: routing constraints ----
alter table public.vehicles add column if not exists avg_speed_kmh numeric not null default 40;
alter table public.vehicles add column if not exists max_stops int;
alter table public.vehicles add column if not exists avoid_tolls boolean not null default false;

-- ---- routes: departure + optimization results ----
alter table public.routes add column if not exists start_time time not null default '08:00';
alter table public.routes add column if not exists avoid_tolls boolean not null default false;
alter table public.routes add column if not exists total_distance_km numeric;
alter table public.routes add column if not exists total_duration_min int;
alter table public.routes add column if not exists optimized_at timestamptz;

-- ---- route_stops: per-stop schedule + predicted delay ----
alter table public.route_stops add column if not exists eta timestamptz;
alter table public.route_stops add column if not exists planned_service_minutes int;
alter table public.route_stops add column if not exists distance_from_prev_km numeric;
alter table public.route_stops add column if not exists predicted_delay_min int not null default 0;

-- ---- RLS for the new tables ----
alter table public.org_settings   enable row level security;
alter table public.delivery_zones enable row level security;

drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select on public.org_settings for select
  using (auth.uid() is not null);

drop policy if exists org_settings_write on public.org_settings;
create policy org_settings_write on public.org_settings for all
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists zones_select on public.delivery_zones;
create policy zones_select on public.delivery_zones for select
  using (auth.uid() is not null);

drop policy if exists zones_write on public.delivery_zones;
create policy zones_write on public.delivery_zones for all
  using (public.is_manager()) with check (public.is_manager());
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

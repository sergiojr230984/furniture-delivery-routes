-- =====================================================================
--  Advanced Routing upgrade
--  Adds: geo-coordinates, delivery zones, on-demand orders, routing
--  constraints, predictive ETAs and depot settings.
--
--  Safe to run on an existing database (idempotent) AND included at the
--  end of schema.sql for fresh installs.
-- =====================================================================

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

-- (also include tracking upgrade in the single upgrade file)
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

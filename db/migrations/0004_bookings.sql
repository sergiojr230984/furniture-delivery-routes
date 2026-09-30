-- =====================================================================
-- Bookings: the delivery job a retailer creates, plus its pickups, items,
-- destination/access details, and post-acceptance change orders.
-- =====================================================================
do $$ begin
  create type booking_status as enum (
    'draft','quote_ready','awaiting_acceptance','confirmed',
    'en_route_pickup','picked_up','en_route_delivery',
    'delivered','partially_delivered','failed','cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_level as enum ('curbside','room_of_choice','room_of_choice_assembly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pickup_type as enum ('store','address','warehouse');
exception when duplicate_object then null; end $$;

do $$ begin
  create type packaging_condition as enum ('original_box','wrapped','unwrapped','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_mode as enum ('internal','marketplace');
exception when duplicate_object then null; end $$;

create sequence if not exists public.booking_number_seq;

create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  booking_number        text unique,
  retailer_org_id       uuid not null references public.organizations(id),
  retailer_location_id  uuid references public.retailer_locations(id),
  created_by            uuid references public.users(id) on delete set null,
  status                booking_status not null default 'draft',
  mode                  booking_mode not null default 'internal',
  service_level         service_level not null default 'curbside',
  priority              boolean not null default false,   -- priority/dedicated service
  debris_removal        boolean not null default false,   -- disabled by default
  old_furniture_removal boolean not null default false,   -- disabled by default
  window_date           date,
  window_start          time,
  window_end            time,
  pricing_rule_set_id   uuid references public.pricing_rule_sets(id),
  quote                 jsonb,          -- full itemized breakdown snapshot at accepted-quote time
  price_total           numeric(10,2),
  currency              text not null default 'USD',
  cancellation_terms    text,
  internal_notes        text,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_bookings_updated on public.bookings;
create trigger trg_bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

create or replace function public.set_booking_number()
returns trigger language plpgsql as $$
begin
  if new.booking_number is null then
    new.booking_number := 'BD-' || lpad(nextval('public.booking_number_seq')::text, 6, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_booking_number on public.bookings;
create trigger trg_booking_number before insert on public.bookings
  for each row execute function public.set_booking_number();

create index if not exists idx_bookings_retailer on public.bookings(retailer_org_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_bookings_window_date on public.bookings(window_date);

-- ---- Pickups (a booking may have more than one pickup) --------------------
create table if not exists public.booking_pickups (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings(id) on delete cascade,
  sequence          int not null default 1,
  pickup_type       pickup_type not null default 'store',
  location_id       uuid references public.retailer_locations(id),
  warehouse_id      uuid references public.belliza_warehouses(id),
  warehouse_order_number text,
  address_line1     text,
  address_line2     text,
  city              text,
  state             text default 'FL',
  postal_code       text,
  latitude          double precision,
  longitude         double precision,
  contact_name      text,
  contact_phone     text,
  floor             int,
  stairs_flights    int not null default 0,
  elevator_available boolean not null default false,
  parking_notes     text,
  instructions      text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_booking_pickups_booking on public.booking_pickups(booking_id);

-- ---- Line items -------------------------------------------------------------
create table if not exists public.booking_items (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings(id) on delete cascade,
  saved_product_id    uuid references public.saved_products(id),
  name                text not null,
  category            item_category not null default 'misc',
  quantity            int not null default 1,
  length_in           numeric(6,1),
  width_in            numeric(6,1),
  height_in           numeric(6,1),
  weight_lbs          numeric(7,1),
  dims_unknown        boolean not null default false,
  photos              jsonb not null default '[]'::jsonb,  -- array of private file paths
  declared_value      numeric(10,2),
  packaging_condition packaging_condition not null default 'unknown',
  assembly_required   boolean not null default false,
  needs_review        boolean not null default false,      -- unusual/heavy/unknown-dims flag
  review_reason       text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_booking_items_booking on public.booking_items(booking_id);

-- ---- Destination + access details -------------------------------------------
create table if not exists public.booking_destination (
  booking_id          uuid primary key references public.bookings(id) on delete cascade,
  customer_name       text,
  customer_phone      text,
  customer_email      text,
  address_line1       text,
  address_line2       text,
  city                text,
  state               text default 'FL',
  postal_code         text,
  latitude            double precision,
  longitude           double precision,
  floor               int,
  stairs_flights      int not null default 0,
  elevator_available  boolean not null default false,
  elevator_reserved   boolean not null default false,
  building_hours      text,
  parking_notes       text,
  walking_distance_ft int,
  instructions        text,
  access_completed    boolean not null default false,
  access_token        text unique,
  access_token_expires_at timestamptz,
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_booking_destination_updated on public.booking_destination;
create trigger trg_booking_destination_updated before update on public.booking_destination
  for each row execute function public.set_updated_at();

-- ---- Change orders: any post-acceptance price/window change ----------------
create table if not exists public.change_orders (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  requested_by   uuid references public.users(id) on delete set null,
  reason         text not null,
  old_price      numeric(10,2),
  new_price      numeric(10,2),
  old_window     jsonb,
  new_window     jsonb,
  status         text not null default 'pending', -- pending | approved | rejected
  approved_by    uuid references public.users(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_change_orders_booking on public.change_orders(booking_id);

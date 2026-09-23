-- =====================================================================
-- Retailer-side and provider-side organizational data
-- =====================================================================

-- ---- Belliza warehouses (platform-owned pickup points) -----------------
create table if not exists public.belliza_warehouses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null default 'Miami',
  state         text not null default 'FL',
  postal_code   text not null,
  latitude      double precision,
  longitude     double precision,
  created_at    timestamptz not null default now()
);

-- ---- Retailer store locations -------------------------------------------
create table if not exists public.retailer_locations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null default 'Miami',
  state         text not null default 'FL',
  postal_code   text not null,
  latitude      double precision,
  longitude     double precision,
  is_default    boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_retailer_locations_org on public.retailer_locations(org_id);

-- ---- Saved product templates (reusable across bookings) -----------------
do $$ begin
  create type item_category as enum (
    'sofa','sectional','bed_frame','mattress','dining_set','mirror',
    'tv_stand','dresser','table','chair','misc'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.saved_products (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  category          item_category not null default 'misc',
  length_in         numeric(6,1),
  width_in          numeric(6,1),
  height_in         numeric(6,1),
  weight_lbs        numeric(7,1),
  default_assembly_required boolean not null default false,
  photo_path        text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_saved_products_org on public.saved_products(org_id);

-- ---- Provider vehicles ----------------------------------------------------
create table if not exists public.provider_vehicles (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  name           text not null,             -- "Van 1", "Box Truck A"
  vehicle_type   text not null default 'cargo_van',
  cargo_length_in numeric(6,1),
  cargo_width_in  numeric(6,1),
  cargo_height_in numeric(6,1),
  door_width_in   numeric(6,1),             -- narrowest opening items must pass through
  payload_lbs     numeric(8,1) not null default 1500,
  max_jobs_per_day int not null default 6,  -- conservative capacity unit (see capacity_holds)
  status         text not null default 'active', -- active | maintenance | inactive
  license_plate  text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_provider_vehicles_updated on public.provider_vehicles;
create trigger trg_provider_vehicles_updated before update on public.provider_vehicles
  for each row execute function public.set_updated_at();

create index if not exists idx_provider_vehicles_org on public.provider_vehicles(org_id);

-- ---- Crew members (two-person crew roster per provider) ------------------
create table if not exists public.crew_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null, -- optional login for the mobile job screen
  full_name   text not null,
  phone       text,
  can_assemble boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_crew_members_org on public.crew_members(org_id);
create index if not exists idx_crew_members_user on public.crew_members(user_id);

-- ---- Provider document uploads (insurance, business license, etc.) -------
do $$ begin
  create type document_status as enum ('pending_review','approved','rejected','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.provider_documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  doc_type      text not null,   -- e.g. 'general_liability_insurance','business_license','auto_insurance','w9'
  file_path     text not null,
  issued_at     date,
  expires_at    date,
  status        document_status not null default 'pending_review',
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_notes  text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_provider_documents_org on public.provider_documents(org_id);
create index if not exists idx_provider_documents_expiry on public.provider_documents(expires_at);

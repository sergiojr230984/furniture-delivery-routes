-- =====================================================================
-- Claims, the notification outbox, and warehouse collection appointments
-- (a retailer's own driver picking up from the Belliza warehouse — kept
-- entirely separate from the delivery-job/dispatch tables).
-- =====================================================================
do $$ begin
  create type claim_status as enum ('open','under_review','approved','denied','resolved');
exception when duplicate_object then null; end $$;

create table if not exists public.claims (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings(id) on delete cascade,
  status            claim_status not null default 'open',
  description       text not null,
  requested_amount  numeric(10,2),
  decision_notes    text,
  adjustment_amount numeric(10,2),
  created_by        uuid references public.users(id) on delete set null,
  resolved_by       uuid references public.users(id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_claims_booking on public.claims(booking_id);
create index if not exists idx_claims_status on public.claims(status);

-- Transactional notification outbox. Real adapters (SMS/email) are tried
-- first when credentials are configured; otherwise (or on failure) the
-- message is recorded here as 'demo_sent' so the flow is still visible.
create table if not exists public.notifications_outbox (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid references public.bookings(id) on delete cascade,
  org_id       uuid references public.organizations(id) on delete set null,
  channel      text not null, -- email | sms
  to_address   text not null,
  subject      text,
  body         text not null,
  dedupe_key   text,
  status       text not null default 'demo_sent', -- sent | demo_sent | failed
  created_at   timestamptz not null default now()
);

create unique index if not exists idx_notifications_dedupe
  on public.notifications_outbox(dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_booking on public.notifications_outbox(booking_id);

do $$ begin
  create type warehouse_collection_status as enum
    ('scheduled','checked_in','collected','no_show','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.warehouse_collection_appointments (
  id              uuid primary key default gen_random_uuid(),
  retailer_org_id uuid not null references public.organizations(id),
  warehouse_id    uuid references public.belliza_warehouses(id),
  order_number    text not null,
  scheduled_at    timestamptz not null,
  driver_name     text,
  driver_phone    text,
  vehicle_plate   text,
  status          warehouse_collection_status not null default 'scheduled',
  notes           text,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_warehouse_collection_retailer on public.warehouse_collection_appointments(retailer_org_id);

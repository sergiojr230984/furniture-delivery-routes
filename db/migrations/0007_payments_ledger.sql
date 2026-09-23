-- =====================================================================
-- Payments, provider payouts, and the accounting ledger.
-- =====================================================================
do $$ begin
  create type payment_status as enum (
    'not_required','authorized','captured','refunded','failed','demo_recorded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('pending','eligible','paid','held','demo_recorded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_entry_type as enum (
    'retailer_charge','retailer_refund','provider_payout','provider_adjustment',
    'processing_fee','internal_delivery_cost','claims_allowance','claims_payout'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references public.bookings(id) on delete cascade,
  provider                 text not null default 'stripe',
  stripe_payment_intent_id text unique,
  amount                   numeric(10,2) not null,
  currency                 text not null default 'USD',
  status                   payment_status not null default 'not_required',
  is_demo                  boolean not null default false,
  failure_reason           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

create index if not exists idx_payments_booking on public.payments(booking_id);

create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  provider_org_id uuid not null references public.organizations(id),
  amount          numeric(10,2) not null,
  status          payout_status not null default 'pending',
  is_demo         boolean not null default false,
  held_reason     text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_payouts_provider on public.payouts(provider_org_id);
create index if not exists idx_payouts_assignment on public.payouts(assignment_id);

-- Every dollar that moves is recorded here for the finance/contribution
-- dashboards. Contribution = sum(retailer_charge) - sum(provider_payout)
-- - sum(processing_fee) - sum(internal_delivery_cost) - sum(claims_payout),
-- computed in lib/ledger.ts, never stored as a single "profit" number.
create table if not exists public.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_type  ledger_entry_type not null,
  booking_id  uuid references public.bookings(id) on delete set null,
  org_id      uuid references public.organizations(id) on delete set null,
  amount      numeric(10,2) not null,
  currency    text not null default 'USD',
  is_demo     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ledger_entries_booking on public.ledger_entries(booking_id);
create index if not exists idx_ledger_entries_type on public.ledger_entries(entry_type);
create index if not exists idx_ledger_entries_created on public.ledger_entries(created_at);

-- Webhook idempotency: every processed provider webhook event is recorded
-- once; duplicate deliveries are detected and skipped.
create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);

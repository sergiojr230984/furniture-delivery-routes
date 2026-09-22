-- =====================================================================
-- Belliza Delivery — core: extensions, enums, organizations, users, audit
-- =====================================================================
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create type org_type as enum ('platform', 'retailer', 'provider');
exception when duplicate_object then null; end $$;

do $$ begin
  create type org_status as enum ('active', 'pending_review', 'suspended', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum (
    'platform_admin', 'dispatcher',
    'retailer_owner', 'retailer_staff',
    'provider_owner', 'crew_member'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Organizations: platform (Belliza itself + internal fleet), retailers,
-- delivery providers (Belliza's own crew is a provider org with
-- is_internal_fleet = true, so it flows through the same dispatch code).
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  type              org_type not null,
  name              text not null,
  is_internal_fleet boolean not null default false,
  is_demo           boolean not null default false,
  status            org_status not null default 'active',
  locale_default    text not null default 'en',
  contact_email     text,
  contact_phone     text,
  service_area_notes text,
  contribution_floor_amount numeric(10,2), -- providers below this payout are flagged/blocked
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

create index if not exists idx_organizations_type on public.organizations(type);

-- ---------------------------------------------------------------------
-- Users. Belongs to exactly one organization. Password auth (scrypt hash
-- in application code) rather than a hosted auth provider, so the whole
-- stack runs against a plain Postgres database.
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  role           user_role not null,
  full_name      text not null,
  email          text not null unique,
  phone          text,
  password_hash  text not null,
  locale         text not null default 'en',
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

create index if not exists idx_users_org on public.users(org_id);

-- ---------------------------------------------------------------------
-- Audit log — sensitive/admin actions (approvals, overrides, price
-- changes, document review, payout releases).
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users(id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_created on public.audit_log(created_at desc);

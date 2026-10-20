-- =====================================================================
-- Staff invite-by-email: a retailer owner invites a login by email
-- instead of setting a temporary password for them directly. The invited
-- person follows a secure, expiring link to set their own password.
-- =====================================================================
create table if not exists public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  role        text not null,
  full_name   text,
  email       text not null,
  token       text not null unique,
  invited_by  uuid references public.users(id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_staff_invites_org on public.staff_invites(org_id);

-- At most one *pending* invite per (org, email) at a time — re-inviting
-- after acceptance (accepted_at is set) is fine, e.g. if they're later
-- removed and re-added.
create unique index if not exists idx_staff_invites_pending_email
  on public.staff_invites(org_id, email)
  where accepted_at is null;

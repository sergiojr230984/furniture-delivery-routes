-- =====================================================================
-- Pricing engine: versioned, admin-editable rule sets.
-- The full rate configuration lives in `config` (jsonb) so admins can add
-- new rule types without a migration; lib/pricing.ts is the single place
-- that interprets this config and is unit-tested. Every quote stores a
-- deep copy of the rule-set config it used (bookings.quote), so past
-- quotes never change when rates change later.
-- =====================================================================
create table if not exists public.pricing_rule_sets (
  id            uuid primary key default gen_random_uuid(),
  version       int not null,
  label         text not null,
  status        text not null default 'draft', -- draft | active | archived
  config        jsonb not null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  unique (version)
);

-- Only one active rule set at a time.
create unique index if not exists idx_pricing_rule_sets_one_active
  on public.pricing_rule_sets (status)
  where status = 'active';

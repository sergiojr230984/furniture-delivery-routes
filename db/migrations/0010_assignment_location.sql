-- =====================================================================
-- Last-known crew location per assignment, for live tracking (dispatch
-- board + customer tracking page). A single "last known position" column
-- pair, not a ping-history table — this app needs "where's my driver
-- right now", not a breadcrumb trail.
-- =====================================================================
alter table public.assignments
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz;

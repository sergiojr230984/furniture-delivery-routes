-- Add Google Calendar event ID to routes so we can update/delete events.
-- Run once in Supabase SQL Editor.
alter table public.routes
  add column if not exists calendar_event_id text;

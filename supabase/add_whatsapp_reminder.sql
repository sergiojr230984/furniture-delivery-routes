-- Track whether the day-before WhatsApp reminder has been sent for an order,
-- so the daily cron never messages the same customer twice.
-- Run once in Supabase SQL Editor.
alter table public.delivery_orders
  add column if not exists whatsapp_reminder_sent_at timestamptz;

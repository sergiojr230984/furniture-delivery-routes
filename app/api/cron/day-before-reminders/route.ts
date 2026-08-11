// Daily cron: WhatsApp customers whose delivery is scheduled for tomorrow.
// Triggered by Vercel Cron (see vercel.json) — protected by CRON_SECRET so
// nobody else can invoke it and re-message customers.
//
// Idempotent: each order is stamped with whatsapp_reminder_sent_at once sent,
// so re-running the same day (e.g. a retry) never double-messages anyone.

import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDeliveryReminderWhatsApp } from "@/lib/whatsapp";

// Statuses that mean the order is no longer actionable — skip reminders.
const TERMINAL_STATUSES = ["delivered", "failed"];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = format(tomorrow, "yyyy-MM-dd");

  const { data: orders, error } = await supabase
    .from("delivery_orders")
    .select(
      "id, order_number, contact_name, contact_phone, address_line1, city, time_window_start, time_window_end, status"
    )
    .eq("order_type", "delivery")
    .eq("scheduled_date", tomorrowDate)
    .is("whatsapp_reminder_sent_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = (orders ?? []).filter(
    (o) => !TERMINAL_STATUSES.includes(o.status) && o.contact_phone
  );

  const displayDate = format(tomorrow, "EEE, MMM d");
  let sent = 0;

  for (const order of candidates) {
    const timeWindow =
      order.time_window_start || order.time_window_end
        ? `${order.time_window_start ?? "—"} to ${order.time_window_end ?? "—"}`
        : "your scheduled window";

    const ok = await sendDeliveryReminderWhatsApp({
      phone: order.contact_phone as string,
      contactName: order.contact_name,
      orderNumber: order.order_number,
      scheduledDate: displayDate,
      timeWindow,
    });

    if (ok) {
      await supabase
        .from("delivery_orders")
        .update({ whatsapp_reminder_sent_at: new Date().toISOString() })
        .eq("id", order.id);
      sent++;
    }
  }

  return NextResponse.json({ date: tomorrowDate, candidates: candidates.length, sent });
}

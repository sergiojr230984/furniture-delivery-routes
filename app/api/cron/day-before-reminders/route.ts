// Daily cron: reminds customers whose delivery window is tomorrow (WhatsApp
// when configured, SMS otherwise — see lib/notify.ts). Triggered by Vercel
// Cron (see vercel.json's "crons" entry) — protected by CRON_SECRET so
// nobody else can invoke it and re-message customers.
//
// Idempotent via notifications_outbox's existing dedupe_key mechanism (one
// row per booking, see lib/notify.ts#notifyDayBeforeReminder) — no separate
// "reminder sent" column needed, and a retried/duplicate cron run never
// double-messages anyone.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { notifyDayBeforeReminder } from "@/lib/notify";
import { formatDate, formatWallTime } from "@/lib/time";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured in this environment." }, { status: 501 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await query<{
    id: string;
    booking_number: string;
    retailer_org_id: string;
    window_date: string;
    window_start: string | null;
    window_end: string | null;
    customer_name: string | null;
    customer_phone: string | null;
  }>(
    `select b.id, b.booking_number, b.retailer_org_id, b.window_date, b.window_start, b.window_end,
            d.customer_name, d.customer_phone
     from bookings b
     join booking_destination d on d.booking_id = b.id
     where b.status = 'confirmed'
       and b.window_date = current_date + interval '1 day'
       and d.customer_phone is not null`
  );

  let sent = 0;
  for (const b of bookings) {
    const windowLabel =
      b.window_start || b.window_end
        ? `${formatWallTime(b.window_start)}-${formatWallTime(b.window_end)}`
        : "your scheduled window";

    await notifyDayBeforeReminder({
      id: b.id,
      retailerOrgId: b.retailer_org_id,
      bookingNumber: b.booking_number,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      windowDate: formatDate(b.window_date),
      windowLabel,
    });
    sent++;
  }

  return NextResponse.json({ candidates: bookings.length, sent });
}

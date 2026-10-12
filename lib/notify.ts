// Notification adapters. Real channels are attempted only when credentials
// are configured; every notification is also recorded in the
// notifications_outbox table (status 'sent' or 'demo_sent') so the flow is
// always visible in the admin Notifications screen, and so duplicate sends
// are prevented via dedupe_key.
import { query } from "./db";

const smsConfigured =
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM_NUMBER;
const emailConfigured = !!process.env.SMTP_URL;
const whatsappConfigured = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

export interface NotifyInput {
  bookingId?: string;
  orgId?: string;
  channel: "email" | "sms" | "whatsapp";
  to: string;
  subject?: string;
  body: string;
  dedupeKey?: string;
  // Required when channel is "whatsapp": business-initiated WhatsApp messages
  // must use a pre-approved Message Template (Meta Business Manager →
  // Account tools → Message templates) — free-form text isn't allowed.
  whatsappTemplate?: { name: string; params: string[] };
}

export async function sendNotification(input: NotifyInput): Promise<{ sent: boolean; demo: boolean }> {
  if (input.dedupeKey) {
    const existing = await query(`select id from notifications_outbox where dedupe_key = $1`, [input.dedupeKey]);
    if (existing.length > 0) return { sent: false, demo: false };
  }

  let sent = false;
  if (input.channel === "sms" && smsConfigured) {
    sent = await trySms(input.to, input.body);
  } else if (input.channel === "whatsapp" && whatsappConfigured && input.whatsappTemplate) {
    sent = await tryWhatsapp(input.to, input.whatsappTemplate.name, input.whatsappTemplate.params);
  } else if (input.channel === "email" && emailConfigured) {
    sent = await tryEmail(input.to, input.subject ?? "Belliza Delivery", input.body);
  }

  await query(
    `insert into notifications_outbox (booking_id, org_id, channel, to_address, subject, body, dedupe_key, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.bookingId ?? null,
      input.orgId ?? null,
      input.channel,
      input.to,
      input.subject ?? null,
      input.body,
      input.dedupeKey ?? null,
      sent ? "sent" : "demo_sent",
    ]
  );

  return { sent, demo: !sent };
}

async function trySms(to: string, body: string): Promise<boolean> {
  try {
    const Twilio = (await import("twilio")).default;
    const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({ from: process.env.TWILIO_FROM_NUMBER!, to, body });
    return true;
  } catch (err) {
    console.error("[SMS] send failed, falling back to demo outbox:", err);
    return false;
  }
}

async function tryEmail(_to: string, _subject: string, _body: string): Promise<boolean> {
  // No SMTP client dependency is included by default; wire one in here
  // (e.g. nodemailer against SMTP_URL) when real email is needed.
  return false;
}

// Graph API wants digits only (country code + number, no "+", spaces or dashes).
function normalizeWhatsappPhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function tryWhatsapp(to: string, templateName: string, bodyParams: string[]): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizeWhatsappPhone(to),
        type: "template",
        template: {
          name: templateName,
          language: { code: WHATSAPP_TEMPLATE_LANG },
          components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhatsApp API ${res.status}: ${detail}`);
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] send failed, falling back to demo outbox:", err);
    return false;
  }
}

// Sends a customer-facing update over WhatsApp when it's configured
// (preferred — this is a Miami market where most retail customers have
// WhatsApp), otherwise falls back to SMS. Both branches record to the same
// notifications_outbox with the same dedupe_key, so a customer is never
// double-messaged regardless of which channel ends up being used.
async function sendCustomerUpdate(opts: {
  bookingId: string;
  orgId: string;
  phone: string;
  smsBody: string;
  dedupeKey: string;
  whatsapp: { template: string; params: string[] };
}) {
  if (whatsappConfigured) {
    await sendNotification({
      bookingId: opts.bookingId,
      orgId: opts.orgId,
      channel: "whatsapp",
      to: opts.phone,
      body: opts.smsBody,
      dedupeKey: opts.dedupeKey,
      whatsappTemplate: { name: opts.whatsapp.template, params: opts.whatsapp.params },
    });
  } else {
    await sendNotification({
      bookingId: opts.bookingId,
      orgId: opts.orgId,
      channel: "sms",
      to: opts.phone,
      body: opts.smsBody,
      dedupeKey: opts.dedupeKey,
    });
  }
}

// ---- Booking lifecycle notification helpers --------------------------------

export async function notifyBookingConfirmed(booking: {
  id: string;
  retailerOrgId: string;
  bookingNumber: string;
  customerPhone: string | null;
  customerEmail: string | null;
  windowDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  trackingUrl: string;
}) {
  const windowLabel = `${booking.windowStart ?? ""}-${booking.windowEnd ?? ""}`;
  const body = `Your Belliza Delivery order ${booking.bookingNumber} is confirmed for ${booking.windowDate ?? "TBD"} between ${windowLabel}. Track it: ${booking.trackingUrl}`;
  if (booking.customerPhone) {
    await sendCustomerUpdate({
      bookingId: booking.id,
      orgId: booking.retailerOrgId,
      phone: booking.customerPhone,
      smsBody: body,
      dedupeKey: `booking-confirmed-sms-${booking.id}`,
      whatsapp: {
        template: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED || "booking_confirmed",
        params: [booking.bookingNumber, booking.windowDate ?? "TBD", windowLabel, booking.trackingUrl],
      },
    });
  }
  if (booking.customerEmail) {
    await sendNotification({
      bookingId: booking.id,
      orgId: booking.retailerOrgId,
      channel: "email",
      to: booking.customerEmail,
      subject: `Delivery ${booking.bookingNumber} confirmed`,
      body,
      dedupeKey: `booking-confirmed-email-${booking.id}`,
    });
  }
}

export async function notifyOutForDelivery(booking: {
  id: string;
  retailerOrgId: string;
  bookingNumber: string;
  customerPhone: string | null;
  trackingUrl: string;
}) {
  if (!booking.customerPhone) return;
  await sendCustomerUpdate({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    phone: booking.customerPhone,
    smsBody: `Your Belliza Delivery order ${booking.bookingNumber} is out for delivery. Track it: ${booking.trackingUrl}`,
    dedupeKey: `booking-out-for-delivery-${booking.id}`,
    whatsapp: {
      template: process.env.WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY || "out_for_delivery",
      params: [booking.bookingNumber, booking.trackingUrl],
    },
  });
}

export async function notifyDeliveryCompleted(booking: {
  id: string;
  retailerOrgId: string;
  bookingNumber: string;
  customerPhone: string | null;
  trackingUrl: string;
}) {
  if (!booking.customerPhone) return;
  await sendCustomerUpdate({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    phone: booking.customerPhone,
    smsBody: `Your Belliza Delivery order ${booking.bookingNumber} has been delivered. Thank you! ${booking.trackingUrl}`,
    dedupeKey: `booking-delivered-${booking.id}`,
    whatsapp: {
      template: process.env.WHATSAPP_TEMPLATE_DELIVERED || "delivery_completed",
      params: [booking.bookingNumber, booking.trackingUrl],
    },
  });
}

export async function notifyException(booking: {
  id: string;
  retailerOrgId: string;
  bookingNumber: string;
  customerPhone: string | null;
  reason: string;
  trackingUrl: string;
}) {
  if (!booking.customerPhone) return;
  await sendCustomerUpdate({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    phone: booking.customerPhone,
    smsBody: `There's an update on your Belliza Delivery order ${booking.bookingNumber}: ${booking.reason}. ${booking.trackingUrl}`,
    dedupeKey: `booking-exception-${booking.id}-${Date.now()}`,
    whatsapp: {
      template: process.env.WHATSAPP_TEMPLATE_EXCEPTION || "delivery_exception",
      params: [booking.bookingNumber, booking.reason, booking.trackingUrl],
    },
  });
}

// Sent by the daily day-before-reminder cron (app/api/cron/day-before-reminders).
// Dedupe is keyed per booking (not per day), so a booking only ever gets one
// reminder regardless of how many times the cron runs.
export async function notifyDayBeforeReminder(booking: {
  id: string;
  retailerOrgId: string;
  bookingNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  windowDate: string; // formatted for display, e.g. "Tue, Oct 1"
  windowLabel: string; // e.g. "9:00 AM-12:00 PM"
}) {
  if (!booking.customerPhone) return;
  const name = booking.customerName?.split(" ")[0] ?? "there";
  await sendCustomerUpdate({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    phone: booking.customerPhone,
    smsBody: `Hi ${name}! Reminder: your Belliza Delivery order ${booking.bookingNumber} is scheduled for tomorrow, ${booking.windowDate} between ${booking.windowLabel}.`,
    dedupeKey: `booking-day-before-reminder-${booking.id}`,
    whatsapp: {
      template: process.env.WHATSAPP_TEMPLATE_DAY_BEFORE || "delivery_reminder",
      params: [name, booking.bookingNumber, booking.windowDate, booking.windowLabel],
    },
  });
}

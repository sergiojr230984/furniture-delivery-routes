// Notification adapters. Real channels are attempted only when credentials
// are configured; every notification is also recorded in the
// notifications_outbox table (status 'sent' or 'demo_sent') so the flow is
// always visible in the admin Notifications screen, and so duplicate sends
// are prevented via dedupe_key.
import { query } from "./db";

const smsConfigured =
  !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM_NUMBER;
const emailConfigured = !!process.env.SMTP_URL;

export interface NotifyInput {
  bookingId?: string;
  orgId?: string;
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  dedupeKey?: string;
}

export async function sendNotification(input: NotifyInput): Promise<{ sent: boolean; demo: boolean }> {
  if (input.dedupeKey) {
    const existing = await query(`select id from notifications_outbox where dedupe_key = $1`, [input.dedupeKey]);
    if (existing.length > 0) return { sent: false, demo: false };
  }

  let sent = false;
  if (input.channel === "sms" && smsConfigured) {
    sent = await trySms(input.to, input.body);
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
  const body = `Your Belliza Delivery order ${booking.bookingNumber} is confirmed for ${booking.windowDate ?? "TBD"} between ${booking.windowStart ?? ""}-${booking.windowEnd ?? ""}. Track it: ${booking.trackingUrl}`;
  if (booking.customerPhone) {
    await sendNotification({
      bookingId: booking.id,
      orgId: booking.retailerOrgId,
      channel: "sms",
      to: booking.customerPhone,
      body,
      dedupeKey: `booking-confirmed-sms-${booking.id}`,
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
  await sendNotification({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    channel: "sms",
    to: booking.customerPhone,
    body: `Your Belliza Delivery order ${booking.bookingNumber} is out for delivery. Track it: ${booking.trackingUrl}`,
    dedupeKey: `booking-out-for-delivery-${booking.id}`,
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
  await sendNotification({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    channel: "sms",
    to: booking.customerPhone,
    body: `Your Belliza Delivery order ${booking.bookingNumber} has been delivered. Thank you! ${booking.trackingUrl}`,
    dedupeKey: `booking-delivered-${booking.id}`,
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
  await sendNotification({
    bookingId: booking.id,
    orgId: booking.retailerOrgId,
    channel: "sms",
    to: booking.customerPhone,
    body: `There's an update on your Belliza Delivery order ${booking.bookingNumber}: ${booking.reason}. ${booking.trackingUrl}`,
    dedupeKey: `booking-exception-${booking.id}-${Date.now()}`,
  });
}

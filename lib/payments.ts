// Payment adapter: Stripe test mode when STRIPE_SECRET_KEY is set, otherwise
// a demo adapter that records the charge in the ledger without moving real
// money. Never stores raw card data — Stripe's hosted Payment Element (or
// the demo confirmation button) is the only thing that touches card details.
import { query, withTransaction } from "./db";

const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

async function getStripe() {
  const Stripe = (await import("stripe")).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export interface ChargeResult {
  paymentId: string;
  demo: boolean;
  clientSecret?: string; // present only for real Stripe PaymentIntents
}

// Creates a payment record for a booking. In real mode this creates a
// Stripe PaymentIntent (manual capture, so we can authorize now and capture
// on completion) and returns its client secret for the hosted Payment
// Element. In demo mode it records a 'demo_recorded' payment immediately —
// no real charge is ever created in demo mode.
export async function authorizeBookingPayment(opts: {
  bookingId: string;
  amount: number;
  currency: string;
  isDemoOrg: boolean;
}): Promise<ChargeResult> {
  if (stripeConfigured && !opts.isDemoOrg) {
    const stripe = await getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(opts.amount * 100),
      currency: opts.currency.toLowerCase(),
      capture_method: "manual",
      metadata: { bookingId: opts.bookingId },
    });
    const row = await query<{ id: string }>(
      `insert into payments (booking_id, provider, stripe_payment_intent_id, amount, currency, status, is_demo)
       values ($1,'stripe',$2,$3,$4,'authorized',false) returning id`,
      [opts.bookingId, intent.id, opts.amount, opts.currency]
    );
    return { paymentId: row[0].id, demo: false, clientSecret: intent.client_secret ?? undefined };
  }

  const row = await query<{ id: string }>(
    `insert into payments (booking_id, provider, amount, currency, status, is_demo)
     values ($1,'demo',$2,$3,'demo_recorded',true) returning id`,
    [opts.bookingId, opts.amount, opts.currency]
  );
  return { paymentId: row[0].id, demo: true };
}

export async function captureBookingPayment(paymentId: string): Promise<void> {
  await withTransaction(async (client) => {
    const rows = await client.query(`select * from payments where id = $1 for update`, [paymentId]);
    const payment = rows.rows[0];
    if (!payment) throw new Error("Payment not found");
    if (payment.status === "captured") return; // idempotent

    if (payment.provider === "stripe" && payment.stripe_payment_intent_id) {
      const stripe = await getStripe();
      await stripe.paymentIntents.capture(payment.stripe_payment_intent_id);
    }
    await client.query(`update payments set status = 'captured' where id = $1`, [paymentId]);
  });
}

export async function refundBookingPayment(paymentId: string, amount?: number): Promise<void> {
  await withTransaction(async (client) => {
    const rows = await client.query(`select * from payments where id = $1 for update`, [paymentId]);
    const payment = rows.rows[0];
    if (!payment) throw new Error("Payment not found");

    if (payment.provider === "stripe" && payment.stripe_payment_intent_id) {
      const stripe = await getStripe();
      await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: amount ? Math.round(amount * 100) : undefined,
      });
    }
    await client.query(`update payments set status = 'refunded' where id = $1`, [paymentId]);
    await client.query(
      `insert into ledger_entries (entry_type, booking_id, amount, currency, is_demo, notes)
       values ('retailer_refund', $1, $2, $3, $4, 'Refund issued')`,
      [payment.booking_id, amount ?? payment.amount, payment.currency, payment.is_demo]
    );
  });
}

// Idempotent webhook event recording — call before acting on a webhook
// payload; if this returns false, the event was already processed.
export async function recordWebhookEventOnce(provider: string, eventId: string): Promise<boolean> {
  try {
    await query(`insert into webhook_events (provider, event_id) values ($1, $2)`, [provider, eventId]);
    return true;
  } catch {
    return false; // unique constraint violation => duplicate delivery
  }
}

export function isStripeConfigured(): boolean {
  return stripeConfigured;
}

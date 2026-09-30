import { NextRequest, NextResponse } from "next/server";
import { recordWebhookEventOnce } from "@/lib/payments";
import { query } from "@/lib/db";

// Verifies the Stripe signature and processes payment_intent events
// idempotently. Only reachable meaningfully when STRIPE_SECRET_KEY and
// STRIPE_WEBHOOK_SECRET are configured; without them this route simply has
// nothing to verify against (demo mode never calls out to Stripe).
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Stripe webhooks are not configured in this environment." }, { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const isNew = await recordWebhookEventOnce("stripe", event.id);
  if (!isNew) {
    // Already processed this exact event — return 200 without reprocessing.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as { id: string };
    await query(`update payments set status = 'failed', failure_reason = 'Stripe reported failure' where stripe_payment_intent_id = $1`, [intent.id]);
  }

  return NextResponse.json({ received: true });
}

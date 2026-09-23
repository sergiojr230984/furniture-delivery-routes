// Marketplace offer lifecycle. Acceptance is made atomic by locking the
// specific offer row (`for update`) inside a transaction and re-checking
// its status and expiry before honoring it — a second provider's
// concurrent accept on the same or another offer for the same booking sees
// either a row that's no longer 'pending' or the unique partial index on
// (booking_id) where status='accepted', so exactly one can ever win.
import { withTransaction, query, queryOne } from "./db";
import { createCapacityHold } from "./capacity";
import { authorizeBookingPayment } from "./payments";
import { recordBookingLedgerEntries } from "./ledger";
import { notifyBookingConfirmed } from "./notify";
import { createTrackingToken, trackingUrl } from "./tracking";
import type { QuoteBreakdown } from "./types";

const WIDEN_PAYOUT_MULTIPLIER_CEILING = 1.25; // admin-approved ceiling: never more than 25% above the original payout
const REOFFER_WINDOW_HOURS = 3;

export interface AcceptOfferResult {
  ok: boolean;
  reason?: string;
}

export async function acceptOffer(opts: {
  offerId: string;
  providerOrgId: string; // defense in depth — must match the offer's target
  vehicleId: string;
  crewMemberIds: string[];
  actingUserId: string;
}): Promise<AcceptOfferResult> {
  await query(`update offers set status = 'expired' where status = 'pending' and expires_at < now()`);

  const offer = await queryOne<{
    id: string;
    booking_id: string;
    provider_org_id: string;
    payout_amount: string;
    status: string;
    expires_at: string;
  }>(`select * from offers where id = $1`, [opts.offerId]);

  if (!offer || offer.provider_org_id !== opts.providerOrgId) {
    return { ok: false, reason: "Offer not found." };
  }
  if (offer.status !== "pending" || new Date(offer.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "This offer is no longer available — it may have expired or been taken by another provider." };
  }

  const providerOrg = await queryOne<{ status: string }>(`select status from organizations where id = $1`, [opts.providerOrgId]);
  if (!providerOrg || providerOrg.status !== "active") {
    return { ok: false, reason: "Your account is not currently in good standing to accept new jobs." };
  }
  const expiredRequiredDocs = await queryOne<{ count: string }>(
    `select count(*) from provider_documents where org_id = $1 and status = 'approved' and expires_at is not null and expires_at < current_date`,
    [opts.providerOrgId]
  );
  if (parseInt(expiredRequiredDocs?.count ?? "0", 10) > 0) {
    return { ok: false, reason: "One of your approved documents has expired. Renew it before accepting new jobs." };
  }

  const booking = await queryOne<{ status: string; retailer_org_id: string; window_date: string; is_demo: boolean; quote: QuoteBreakdown; price_total: string; booking_number: string }>(
    `select status, retailer_org_id, window_date, is_demo, quote, price_total, booking_number from bookings where id = $1`,
    [offer.booking_id]
  );
  if (!booking || booking.status !== "awaiting_acceptance") {
    return { ok: false, reason: "This booking is no longer awaiting acceptance." };
  }

  const hold = await createCapacityHold({
    bookingId: offer.booking_id,
    providerOrgId: opts.providerOrgId,
    vehicleId: opts.vehicleId,
    day: booking.window_date,
    committed: true,
  });
  if (!hold.ok) {
    return { ok: false, reason: hold.reason || "No capacity on the selected vehicle for that date." };
  }

  const accepted = await withTransaction(async (client) => {
    const upd = await client.query(
      `update offers set status = 'accepted', responded_at = now() where id = $1 and status = 'pending' returning id`,
      [opts.offerId]
    );
    if (upd.rows.length === 0) return false;

    await client.query(
      `update offers set status = 'cancelled', responded_at = now() where booking_id = $1 and status = 'pending' and id <> $2`,
      [offer.booking_id, opts.offerId]
    );

    const assignment = await client.query<{ id: string }>(
      `insert into assignments (booking_id, provider_org_id, vehicle_id, status, offer_id, assigned_by)
       values ($1,$2,$3,'assigned',$4,$5) returning id`,
      [offer.booking_id, opts.providerOrgId, opts.vehicleId, opts.offerId, opts.actingUserId]
    );
    for (const crewId of opts.crewMemberIds) {
      await client.query(`insert into assignment_crew (assignment_id, crew_member_id) values ($1,$2)`, [assignment.rows[0].id, crewId]);
    }

    await client.query(`update bookings set status = 'confirmed' where id = $1`, [offer.booking_id]);
    await client.query(
      `insert into status_events (booking_id, from_status, to_status, actor_user_id, notes) values ($1,'awaiting_acceptance','confirmed',$2,'Provider accepted offer')`,
      [offer.booking_id, opts.actingUserId]
    );

    await client.query(
      `insert into payouts (assignment_id, provider_org_id, amount, status, is_demo) values ($1,$2,$3,'pending',$4)`,
      [assignment.rows[0].id, opts.providerOrgId, offer.payout_amount, booking.is_demo]
    );

    return true;
  });

  if (!accepted) {
    return { ok: false, reason: "This offer was just taken — reload to see current offers." };
  }

  const payment = await authorizeBookingPayment({
    bookingId: offer.booking_id,
    amount: parseFloat(booking.price_total),
    currency: "USD",
    isDemoOrg: booking.is_demo,
  });
  await query(`update payments set status = $2 where id = $1`, [payment.paymentId, payment.demo ? "demo_recorded" : "authorized"]);

  await recordBookingLedgerEntries({
    bookingId: offer.booking_id,
    retailerOrgId: booking.retailer_org_id,
    providerOrgId: opts.providerOrgId,
    isInternalFleet: false,
    price: parseFloat(booking.price_total),
    providerPayout: parseFloat(offer.payout_amount),
    processingFee: booking.quote?.processingFeeEstimate ?? 0,
    isDemo: booking.is_demo,
  });

  let token = await queryOne<{ token: string }>(`select token from tracking_tokens where booking_id = $1 order by created_at desc limit 1`, [offer.booking_id]);
  if (!token) token = { token: await createTrackingToken(offer.booking_id) };
  const dest = await queryOne<{ customer_phone: string | null; customer_email: string | null }>(
    `select customer_phone, customer_email from booking_destination where booking_id = $1`,
    [offer.booking_id]
  );
  const bookingWithWindow = await queryOne<{ window_date: string; window_start: string; window_end: string }>(
    `select window_date, window_start, window_end from bookings where id = $1`,
    [offer.booking_id]
  );
  await notifyBookingConfirmed({
    id: offer.booking_id,
    retailerOrgId: booking.retailer_org_id,
    bookingNumber: booking.booking_number,
    customerPhone: dest?.customer_phone ?? null,
    customerEmail: dest?.customer_email ?? null,
    windowDate: bookingWithWindow?.window_date ?? null,
    windowStart: bookingWithWindow?.window_start ?? null,
    windowEnd: bookingWithWindow?.window_end ?? null,
    trackingUrl: trackingUrl(token.token),
  });

  return { ok: true };
}

export async function declineOffer(offerId: string, providerOrgId: string): Promise<void> {
  await query(
    `update offers set status = 'declined', responded_at = now() where id = $1 and provider_org_id = $2 and status = 'pending'`,
    [offerId, providerOrgId]
  );
}

export interface WidenResult {
  ok: boolean;
  reason?: string;
  newPayout?: number;
}

// Called by dispatch when nobody has accepted: widens the eligible pool
// (re-offers to every approved provider, including ones that already
// declined/let it expire) and may raise the payout, but never above the
// admin-approved ceiling — it does not repeatedly raise payouts without a
// bound.
export async function widenOffers(bookingId: string, actingUserId: string): Promise<WidenResult> {
  const booking = await queryOne<{ status: string; quote: QuoteBreakdown }>(`select status, quote from bookings where id = $1`, [bookingId]);
  if (!booking || booking.status !== "awaiting_acceptance") {
    return { ok: false, reason: "Booking is not awaiting acceptance." };
  }

  const originalPayout = booking.quote.providerPayout;
  const highestSoFar = await queryOne<{ max: string }>(
    `select coalesce(max(payout_amount),0) as max from offers where booking_id = $1`,
    [bookingId]
  );
  const current = parseFloat(highestSoFar?.max ?? "0") || originalPayout;
  const ceiling = round2(originalPayout * WIDEN_PAYOUT_MULTIPLIER_CEILING);
  const newPayout = Math.min(round2(current * 1.1), ceiling);

  await withTransaction(async (client) => {
    await client.query(`update offers set status = 'expired' where booking_id = $1 and status = 'pending'`, [bookingId]);
    const providers = await client.query<{ id: string }>(
      `select id from organizations where type = 'provider' and is_internal_fleet = false and status = 'active'`
    );
    const expiresAt = new Date(Date.now() + REOFFER_WINDOW_HOURS * 3_600_000).toISOString();
    for (const p of providers.rows) {
      await client.query(
        `insert into offers (booking_id, provider_org_id, payout_amount, scope, expires_at, created_by)
         values ($1,$2,$3,$4::jsonb,$5,$6)`,
        [bookingId, p.id, newPayout, JSON.stringify({ widened: true }), expiresAt, actingUserId]
      );
    }
    await client.query(
      `insert into audit_log (actor_user_id, action, entity_type, entity_id, meta) values ($1,'widen_offers','booking',$2,$3::jsonb)`,
      [actingUserId, bookingId, JSON.stringify({ previousPayout: current, newPayout, ceiling })]
    );
  });

  return { ok: true, newPayout };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

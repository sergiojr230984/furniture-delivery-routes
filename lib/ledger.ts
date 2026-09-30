// Illustrative contribution accounting. This is explicitly an ESTIMATE, not
// audited profit: contribution = retailer charges - refunds - provider
// payouts - processing fees - internal delivery costs - actual claims
// payouts. Claims *allowances* (reserves) are reported separately and never
// subtracted alongside the actual payout they reserve for, to avoid
// double-counting.
import { query } from "./db";
import type { LedgerEntryType } from "./constants";

export interface LedgerTotals {
  retailer_charge: number;
  retailer_refund: number;
  provider_payout: number;
  provider_adjustment: number;
  processing_fee: number;
  internal_delivery_cost: number;
  claims_allowance: number;
  claims_payout: number;
}

const ZERO_TOTALS: LedgerTotals = {
  retailer_charge: 0,
  retailer_refund: 0,
  provider_payout: 0,
  provider_adjustment: 0,
  processing_fee: 0,
  internal_delivery_cost: 0,
  claims_allowance: 0,
  claims_payout: 0,
};

export async function getLedgerTotals(opts: { from?: string; to?: string; includeDemo?: boolean } = {}): Promise<{
  totals: LedgerTotals;
  contributionEstimate: number;
}> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.from) {
    params.push(opts.from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (opts.to) {
    params.push(opts.to);
    conditions.push(`created_at <= $${params.length}`);
  }
  if (!opts.includeDemo) {
    conditions.push(`is_demo = false`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const rows = await query<{ entry_type: LedgerEntryType; total: string }>(
    `select entry_type, sum(amount) as total from ledger_entries ${where} group by entry_type`,
    params
  );

  const totals: LedgerTotals = { ...ZERO_TOTALS };
  for (const r of rows) {
    totals[r.entry_type] = parseFloat(r.total);
  }

  const contributionEstimate =
    totals.retailer_charge -
    totals.retailer_refund -
    totals.provider_payout -
    totals.provider_adjustment -
    totals.processing_fee -
    totals.internal_delivery_cost -
    totals.claims_payout;

  return { totals, contributionEstimate };
}

export async function recordBookingLedgerEntries(opts: {
  bookingId: string;
  retailerOrgId: string;
  providerOrgId: string;
  isInternalFleet: boolean;
  price: number;
  providerPayout: number;
  processingFee: number;
  isDemo: boolean;
}): Promise<void> {
  await query(
    `insert into ledger_entries (entry_type, booking_id, org_id, amount, currency, is_demo, notes)
     values ('retailer_charge', $1, $2, $3, 'USD', $4, 'Booking charge')`,
    [opts.bookingId, opts.retailerOrgId, opts.price, opts.isDemo]
  );
  await query(
    `insert into ledger_entries (entry_type, booking_id, org_id, amount, currency, is_demo, notes)
     values ('processing_fee', $1, $2, $3, 'USD', $4, 'Estimated card processing cost')`,
    [opts.bookingId, opts.retailerOrgId, opts.processingFee, opts.isDemo]
  );
  if (opts.isInternalFleet) {
    // No external payout — record the equivalent as an internal delivery
    // cost so internal jobs are never mistaken for pure margin.
    await query(
      `insert into ledger_entries (entry_type, booking_id, org_id, amount, currency, is_demo, notes)
       values ('internal_delivery_cost', $1, $2, $3, 'USD', $4, 'Internal crew cost (no card payout)')`,
      [opts.bookingId, opts.providerOrgId, opts.providerPayout, opts.isDemo]
    );
  } else {
    await query(
      `insert into ledger_entries (entry_type, booking_id, org_id, amount, currency, is_demo, notes)
       values ('provider_payout', $1, $2, $3, 'USD', $4, 'Provider payout for accepted job')`,
      [opts.bookingId, opts.providerOrgId, opts.providerPayout, opts.isDemo]
    );
  }
}

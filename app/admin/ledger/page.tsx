import { requireRole } from "@/lib/auth";
import { getLedgerTotals } from "@/lib/ledger";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import type { LedgerTotals } from "@/lib/ledger";

export default async function AdminLedgerPage() {
  await requireRole("platform_admin", "dispatcher");
  const real = await getLedgerTotals({ includeDemo: false });
  const all = await getLedgerTotals({ includeDemo: true });
  const recent = await query<{ entry_type: string; amount: string; is_demo: boolean; notes: string | null; created_at: string; booking_number: string | null }>(
    `select l.entry_type, l.amount, l.is_demo, l.notes, l.created_at, b.booking_number
     from ledger_entries l left join bookings b on b.id = l.booking_id
     order by l.created_at desc limit 100`
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Finance</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Real transactions only</h2>
          <LedgerGrid totals={real.totals} contribution={real.contributionEstimate} />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Including demo data</h2>
          <LedgerGrid totals={all.totals} contribution={all.contributionEstimate} />
        </div>
      </div>

      <p className="text-xs text-navy-400">
        Contribution estimate = retailer charges − refunds − provider payouts/adjustments − processing fees −
        internal delivery costs − actual claims payouts. This is an illustrative estimate, not audited profit, and
        does not double-count claims reserves against actual payouts.
      </p>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Recent ledger entries</h2>
        <div className="max-h-96 overflow-y-auto">
          <ul className="divide-y divide-navy-100 text-sm">
            {recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>
                  {e.entry_type.replace(/_/g, " ")} {e.booking_number && `— ${e.booking_number}`} {e.is_demo && <span className="text-navy-400">(demo)</span>}
                </span>
                <span className="text-right">
                  <div className="font-medium">{formatMoney(e.amount)}</div>
                  <div className="text-xs text-navy-400">{formatDateTime(e.created_at)}</div>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function LedgerGrid({ totals, contribution }: { totals: LedgerTotals; contribution: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <Row label="Retailer charges" value={totals.retailer_charge} />
      <Row label="Refunds" value={-totals.retailer_refund} />
      <Row label="Provider payouts" value={-totals.provider_payout} />
      <Row label="Processing fees" value={-totals.processing_fee} />
      <Row label="Internal delivery cost" value={-totals.internal_delivery_cost} />
      <Row label="Claims payouts" value={-totals.claims_payout} />
      <div className="col-span-2 mt-2 flex justify-between border-t border-navy-200 pt-2 font-bold text-orange-600">
        <span>Contribution estimate</span>
        <span>{formatMoney(contribution)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-navy-600">
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );
}

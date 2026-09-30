import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getLedgerTotals } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { todayInEastern } from "@/lib/time";

export default async function AdminDashboardPage() {
  await requireRole("platform_admin", "dispatcher");

  const today = todayInEastern();
  const [todayCount, unassigned, awaitingAcceptance, exceptions, activeRetailers, ledger] = await Promise.all([
    queryOne<{ count: string }>(`select count(*) from bookings where window_date = $1`, [today]),
    queryOne<{ count: string }>(
      `select count(*) from bookings b where b.status = 'confirmed' and not exists (select 1 from assignments a where a.booking_id = b.id)`
    ),
    queryOne<{ count: string }>(`select count(*) from bookings where status = 'awaiting_acceptance'`),
    queryOne<{ count: string }>(`select count(*) from bookings where status in ('failed','partially_delivered')`),
    query<{ name: string; bookings: string }>(
      `select o.name, count(b.id) as bookings from organizations o
       join bookings b on b.retailer_org_id = o.id
       where o.type = 'retailer'
       group by o.name order by bookings desc limit 5`
    ),
    getLedgerTotals({ includeDemo: true }),
  ]);

  const cards = [
    { label: "Deliveries today", value: todayCount?.count ?? "0" },
    { label: "Unassigned confirmed jobs", value: unassigned?.count ?? "0" },
    { label: "Awaiting provider acceptance", value: awaitingAcceptance?.count ?? "0" },
    { label: "Open exceptions", value: exceptions?.count ?? "0" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Admin Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-2xl font-bold text-navy-900">{c.value}</div>
            <div className="text-xs text-navy-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Illustrative contribution (demo + real, this period)</h2>
        <p className="mb-3 text-xs text-navy-400">
          Estimate = retailer charges − refunds − provider payouts/adjustments − processing fees − internal delivery
          costs − actual claims payouts. Not audited profit.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label="Retailer charges" value={ledger.totals.retailer_charge} />
          <Stat label="Provider payouts" value={ledger.totals.provider_payout} />
          <Stat label="Internal delivery cost" value={ledger.totals.internal_delivery_cost} />
          <Stat label="Contribution estimate" value={ledger.contributionEstimate} highlight />
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Active repeat retailers</h2>
        <ul className="text-sm text-navy-600">
          {activeRetailers.map((r) => (
            <li key={r.name} className="flex justify-between border-b border-navy-50 py-1 last:border-0">
              <span>{r.name}</span>
              <span>{r.bookings} bookings</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-bold ${highlight ? "text-orange-600" : "text-navy-800"}`}>{formatMoney(value)}</div>
      <div className="text-xs text-navy-400">{label}</div>
    </div>
  );
}

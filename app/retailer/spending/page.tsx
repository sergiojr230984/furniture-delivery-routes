import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import StatusBadge from "@/components/StatusBadge";
import type { Booking } from "@/lib/types";

export default async function RetailerSpendingPage() {
  const user = await requireRole("retailer_owner");

  const summary = await queryOne<{ total_30: string; total_90: string; count_30: string }>(
    `select
       coalesce(sum(price_total) filter (where created_at > now() - interval '30 days'), 0) as total_30,
       coalesce(sum(price_total) filter (where created_at > now() - interval '90 days'), 0) as total_90,
       count(*) filter (where created_at > now() - interval '30 days') as count_30
     from bookings where retailer_org_id = $1 and status not in ('draft','cancelled')`,
    [user.org_id]
  );

  const receipts = await query<Booking>(
    `select * from bookings where retailer_org_id = $1 and status not in ('draft','cancelled') order by created_at desc limit 50`,
    [user.org_id]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Company Spending</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(summary?.total_30 ?? 0)}</div>
          <div className="text-xs text-navy-500">Last 30 days ({summary?.count_30 ?? 0} deliveries)</div>
        </div>
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(summary?.total_90 ?? 0)}</div>
          <div className="text-xs text-navy-500">Last 90 days</div>
        </div>
      </div>

      <div className="card divide-y divide-navy-100">
        {receipts.map((b) => (
          <div key={b.id} className="flex items-center justify-between p-4 text-sm">
            <span>
              {b.booking_number} — {formatDate(b.created_at)}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatMoney(b.price_total ?? 0)}</span>
              <StatusBadge status={b.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

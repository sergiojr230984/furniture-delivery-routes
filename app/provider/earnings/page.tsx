import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default async function ProviderEarningsPage() {
  const user = await requireRole("provider_owner");

  const totals = await queryOne<{ pending: string; eligible: string; paid: string }>(
    `select
       coalesce(sum(amount) filter (where status = 'pending'), 0) as pending,
       coalesce(sum(amount) filter (where status = 'eligible'), 0) as eligible,
       coalesce(sum(amount) filter (where status in ('paid','demo_recorded')), 0) as paid
     from payouts where provider_org_id = $1`,
    [user.org_id]
  );

  const payouts = await query<{ amount: string; status: string; booking_number: string; created_at: string }>(
    `select p.amount, p.status, b.booking_number, p.created_at
     from payouts p join assignments a on a.id = p.assignment_id join bookings b on b.id = a.booking_id
     where p.provider_org_id = $1 order by p.created_at desc limit 50`,
    [user.org_id]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Earnings</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(totals?.pending ?? 0)}</div>
          <div className="text-xs text-navy-500">Pending (job not yet completed)</div>
        </div>
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(totals?.eligible ?? 0)}</div>
          <div className="text-xs text-navy-500">Eligible for payout</div>
        </div>
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(totals?.paid ?? 0)}</div>
          <div className="text-xs text-navy-500">Paid</div>
        </div>
      </div>

      <div className="card divide-y divide-navy-100">
        {payouts.map((p, i) => (
          <div key={i} className="flex items-center justify-between p-4 text-sm">
            <span>{p.booking_number} — {formatDate(p.created_at)}</span>
            <span className="font-medium">{formatMoney(p.amount)} · {p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

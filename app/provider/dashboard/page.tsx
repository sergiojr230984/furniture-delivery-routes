import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getProviderRatingSummary, listProviderRatings } from "@/lib/ratings";
import StarRating from "@/components/StarRating";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export default async function ProviderDashboardPage() {
  const user = await requireRole("provider_owner");

  const [pendingOffers, activeJobs, earnings, ratingSummary, recentRatings] = await Promise.all([
    queryOne<{ count: string }>(
      `select count(*) from offers where provider_org_id = $1 and status = 'pending' and expires_at > now()`,
      [user.org_id]
    ),
    queryOne<{ count: string }>(
      `select count(*) from assignments where provider_org_id = $1 and status not in ('completed','failed','cancelled')`,
      [user.org_id]
    ),
    queryOne<{ pending: string; eligible: string }>(
      `select coalesce(sum(amount) filter (where status = 'pending'), 0) as pending,
              coalesce(sum(amount) filter (where status = 'eligible'), 0) as eligible
       from payouts where provider_org_id = $1`,
      [user.org_id]
    ),
    getProviderRatingSummary(user.org_id),
    listProviderRatings(user.org_id, 5),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Provider Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/provider/offers" className="card p-4 hover:bg-navy-50">
          <div className="text-xl font-bold text-navy-900">{pendingOffers?.count ?? 0}</div>
          <div className="text-xs text-navy-500">Open offers</div>
        </Link>
        <Link href="/provider/routes" className="card p-4 hover:bg-navy-50">
          <div className="text-xl font-bold text-navy-900">{activeJobs?.count ?? 0}</div>
          <div className="text-xs text-navy-500">Active jobs</div>
        </Link>
        <Link href="/provider/earnings" className="card p-4 hover:bg-navy-50">
          <div className="text-xl font-bold text-navy-900">{formatMoney(earnings?.eligible ?? 0)}</div>
          <div className="text-xs text-navy-500">Eligible for payout</div>
        </Link>
        <div className="card p-4">
          <div className="text-xl font-bold text-navy-900">{formatMoney(earnings?.pending ?? 0)}</div>
          <div className="text-xs text-navy-500">Pending (in progress)</div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Your rating</h2>
        {ratingSummary.avg == null ? (
          <p className="text-sm text-navy-500">No ratings yet — they&apos;ll show up here once retailers rate completed jobs.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StarRating value={ratingSummary.avg} size="text-2xl" />
              <span className="text-lg font-bold text-navy-900">{ratingSummary.avg.toFixed(1)}</span>
              <span className="text-sm text-navy-500">({ratingSummary.count} rating{ratingSummary.count === 1 ? "" : "s"})</span>
            </div>
            {recentRatings.length > 0 && (
              <ul className="mt-3 divide-y divide-navy-100">
                {recentRatings.map((r, i) => (
                  <li key={i} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <StarRating value={r.rating} />
                      <span className="text-xs text-navy-400">
                        {r.booking_number} · {formatDate(r.created_at)}
                      </span>
                    </div>
                    {r.comment && <p className="mt-1 text-navy-600">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

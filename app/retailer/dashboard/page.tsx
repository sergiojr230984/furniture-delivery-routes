import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking } from "@/lib/types";

export default async function RetailerDashboardPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");

  const upcoming = await query<Booking & { customer_name: string | null }>(
    `select b.*, d.customer_name from bookings b
     left join booking_destination d on d.booking_id = b.id
     where b.retailer_org_id = $1 and b.status in ('confirmed','awaiting_acceptance','en_route_pickup','picked_up','en_route_delivery')
     order by b.window_date nulls last limit 10`,
    [user.org_id]
  );
  const exceptions = await query<Booking>(
    `select * from bookings where retailer_org_id = $1 and status in ('failed','partially_delivered') order by updated_at desc limit 5`,
    [user.org_id]
  );
  const spend = await queryOne<{ total: string }>(
    `select coalesce(sum(price_total),0) as total from bookings where retailer_org_id = $1 and created_at > now() - interval '30 days'`,
    [user.org_id]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
        <Link href="/retailer/book" className="btn-primary">
          Book a delivery
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card p-4">
          <div className="text-2xl font-bold text-navy-900">{upcoming.length}</div>
          <div className="text-xs text-navy-500">Upcoming deliveries</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-navy-900">{exceptions.length}</div>
          <div className="text-xs text-navy-500">Exceptions</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-navy-900">{formatMoney(spend?.total ?? 0)}</div>
          <div className="text-xs text-navy-500">Spend (30 days)</div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-navy-800">Upcoming deliveries</h2>
        {upcoming.length === 0 && <p className="text-sm text-navy-500">Nothing scheduled.</p>}
        <ul className="divide-y divide-navy-100">
          {upcoming.map((b) => (
            <li key={b.id}>
              <Link href={`/retailer/bookings/${b.id}`} className="flex items-center justify-between py-2 text-sm hover:text-orange-600">
                <span>
                  {b.booking_number} — {b.customer_name} {b.window_date && `(${formatDate(b.window_date)})`}
                </span>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking } from "@/lib/types";

export default async function AdminBookingsPage() {
  await requireRole("platform_admin", "dispatcher");
  const bookings = await query<Booking & { retailer_name: string; customer_name: string | null }>(
    `select b.*, o.name as retailer_name, d.customer_name
     from bookings b
     join organizations o on o.id = b.retailer_org_id
     left join booking_destination d on d.booking_id = b.id
     order by b.created_at desc limit 200`
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">All Bookings</h1>
      <div className="card divide-y divide-navy-100">
        {bookings.map((b) => (
          <Link key={b.id} href={`/admin/bookings/${b.id}`} className="flex items-center justify-between p-4 hover:bg-navy-50">
            <div>
              <div className="font-medium text-navy-800">
                {b.booking_number} — {b.retailer_name}
              </div>
              <div className="text-xs text-navy-400">
                {b.customer_name} · {b.window_date ? formatDate(b.window_date) : "no window"} {b.is_demo && "· Demo"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {b.price_total && <span className="text-sm text-navy-700">{formatMoney(b.price_total)}</span>}
              <StatusBadge status={b.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

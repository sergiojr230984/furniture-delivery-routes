import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking } from "@/lib/types";

export default async function RetailerBookingsPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const bookings = await query<Booking & { customer_name: string | null }>(
    `select b.*, d.customer_name from bookings b
     left join booking_destination d on d.booking_id = b.id
     where b.retailer_org_id = $1
     order by b.created_at desc limit 100`,
    [user.org_id]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Bookings</h1>
        <Link href="/retailer/book" className="btn-primary">
          New booking
        </Link>
      </div>

      <div className="card divide-y divide-navy-100">
        {bookings.length === 0 && <p className="p-5 text-navy-500">No bookings yet.</p>}
        {bookings.map((b) => (
          <Link key={b.id} href={`/retailer/bookings/${b.id}`} className="flex items-center justify-between p-4 hover:bg-navy-50">
            <div>
              <div className="font-medium text-navy-800">
                {b.booking_number} — {b.customer_name || "Draft"}
              </div>
              <div className="text-xs text-navy-400">
                {b.window_date ? formatDate(b.window_date) : "No window yet"} {b.is_demo && "· Demo"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {b.price_total && <span className="text-sm font-medium text-navy-700">{formatMoney(b.price_total)}</span>}
              <StatusBadge status={b.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

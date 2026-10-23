import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import BookingsList from "./BookingsList";
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

      <BookingsList bookings={bookings} />
    </div>
  );
}

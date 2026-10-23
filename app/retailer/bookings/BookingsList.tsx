"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking } from "@/lib/types";

type Row = Booking & { customer_name: string | null };

// Bookings lists have no way to find a specific order today beyond
// scrolling — every comparable dispatch/ops tool treats a search box over
// a record list as table stakes. Filters client-side over the page's own
// (already-limited to 100) rows — no extra round trip needed at this scale.
export default function BookingsList({ bookings }: { bookings: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.booking_number?.toLowerCase().includes(q) ||
        b.customer_name?.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q.replace(/ /g, "_"))
    );
  }, [bookings, query]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
        <input
          className="input pl-9"
          placeholder="Search by order #, customer, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card divide-y divide-navy-100">
        {bookings.length === 0 && <p className="p-5 text-navy-500">No bookings yet.</p>}
        {bookings.length > 0 && filtered.length === 0 && <p className="p-5 text-navy-500">No bookings match &quot;{query}&quot;.</p>}
        {filtered.map((b) => (
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

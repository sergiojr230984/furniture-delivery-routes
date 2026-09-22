import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export default async function ProviderOffersPage() {
  const user = await requireRole("provider_owner");

  const offers = await query<{
    id: string;
    booking_number: string;
    payout_amount: string;
    expires_at: string;
    window_date: string | null;
    city: string | null;
  }>(
    `select o.id, b.booking_number, o.payout_amount, o.expires_at, b.window_date, d.city
     from offers o
     join bookings b on b.id = o.booking_id
     left join booking_destination d on d.booking_id = b.id
     where o.provider_org_id = $1 and o.status = 'pending' and o.expires_at > now()
     order by o.expires_at`,
    [user.org_id]
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Available Offers</h1>
      {offers.length === 0 && <p className="text-navy-500">No open offers right now.</p>}
      <ul className="space-y-3">
        {offers.map((o) => (
          <li key={o.id}>
            <Link href={`/provider/offers/${o.id}`} className="card block p-4 hover:bg-navy-50">
              <div className="flex items-center justify-between">
                <span className="font-medium text-navy-800">{o.booking_number}</span>
                <span className="font-bold text-orange-600">{formatMoney(o.payout_amount)}</span>
              </div>
              <div className="text-sm text-navy-500">{o.city} {o.window_date && `· ${o.window_date}`}</div>
              <div className="text-xs text-navy-400">Expires {formatDateTime(o.expires_at)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

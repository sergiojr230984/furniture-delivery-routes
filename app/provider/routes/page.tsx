import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate, formatWallTime } from "@/lib/time";
import { formatMoney } from "@/lib/money";

export default async function ProviderRoutesPage() {
  const user = await requireRole("provider_owner");

  const jobs = await query<{
    id: string;
    booking_number: string;
    status: string;
    window_date: string | null;
    window_start: string | null;
    window_end: string | null;
    vehicle_name: string | null;
    payout: string | null;
    crew: string | null;
  }>(
    `select a.id, b.booking_number, a.status, b.window_date, b.window_start, b.window_end, v.name as vehicle_name,
            (select amount from payouts p where p.assignment_id = a.id) as payout,
            (select string_agg(cm.full_name, ', ') from assignment_crew ac join crew_members cm on cm.id = ac.crew_member_id where ac.assignment_id = a.id) as crew
     from assignments a
     join bookings b on b.id = a.booking_id
     left join provider_vehicles v on v.id = a.vehicle_id
     where a.provider_org_id = $1
     order by b.window_date desc nulls last`,
    [user.org_id]
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">My Routes</h1>
      <div className="card divide-y divide-navy-100">
        {jobs.length === 0 && <p className="p-5 text-navy-500">No jobs yet.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-navy-800">{j.booking_number}</span>
              <span className="text-xs uppercase tracking-wide text-orange-600">{j.status.replace(/_/g, " ")}</span>
            </div>
            <div className="text-sm text-navy-500">
              {j.window_date && formatDate(j.window_date)} {j.window_start && `· ${formatWallTime(j.window_start)}–${formatWallTime(j.window_end)}`} · {j.vehicle_name}
            </div>
            <div className="text-xs text-navy-400">
              Crew: {j.crew || "—"} {j.payout && `· Payout ${formatMoney(j.payout)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

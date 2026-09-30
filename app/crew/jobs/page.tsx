import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listAssignmentsForCrewUser } from "@/lib/crew-service";
import { formatDate, formatWallTime } from "@/lib/time";

export default async function CrewJobsPage() {
  const user = await requireRole("crew_member");
  const jobs = await listAssignmentsForCrewUser(user.id);

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900">Today&apos;s Jobs</h1>
      {jobs.length === 0 && <p className="mt-4 text-navy-500">No jobs assigned right now.</p>}
      <ul className="mt-4 space-y-2">
        {jobs.map((j) => (
          <li key={j.id}>
            <Link href={`/crew/jobs/${j.id}`} className="card block p-4">
              <div className="font-medium text-navy-800">{j.booking_number}</div>
              <div className="text-sm text-navy-500">{j.customer_name} — {j.city}</div>
              <div className="mt-1 text-xs text-navy-400">
                {j.window_date && formatDate(j.window_date)} {j.window_start && `· ${formatWallTime(j.window_start)}–${formatWallTime(j.window_end)}`}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-orange-600">{j.status.replace(/_/g, " ")}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

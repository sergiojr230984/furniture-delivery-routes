import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProviderRatingSummaries } from "@/lib/ratings";
import StarRating from "@/components/StarRating";
import type { Organization } from "@/lib/types";

export default async function AdminOrganizationsPage() {
  await requireRole("platform_admin", "dispatcher");
  const orgs = await query<Organization>(`select * from organizations where type in ('retailer','provider') order by type, name`);
  const providerIds = orgs.filter((o) => o.type === "provider").map((o) => o.id);
  const ratings = await getProviderRatingSummaries(providerIds);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Organizations</h1>
      <div className="card divide-y divide-navy-100">
        {orgs.map((o) => (
          <Link key={o.id} href={`/admin/organizations/${o.id}`} className="flex items-center justify-between p-4 hover:bg-navy-50">
            <div>
              <div className="font-medium text-navy-800">
                {o.name} {o.is_internal_fleet && "(internal fleet)"} {o.is_demo && <span className="text-xs text-navy-400">Demo</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-navy-400">
                <span>{o.type}</span>
                {o.type === "provider" && ratings.get(o.id)?.avg != null && (
                  <span className="flex items-center gap-1">
                    <StarRating value={ratings.get(o.id)!.avg!} />
                    <span>({ratings.get(o.id)!.count})</span>
                  </span>
                )}
              </div>
            </div>
            <span
              className={`badge ${
                o.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : o.status === "pending_review"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {o.status.replace(/_/g, " ")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

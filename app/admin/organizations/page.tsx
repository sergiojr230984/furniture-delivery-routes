import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProviderRatingSummaries } from "@/lib/ratings";
import OrganizationsList from "./OrganizationsList";
import type { Organization } from "@/lib/types";

export default async function AdminOrganizationsPage() {
  await requireRole("platform_admin", "dispatcher");
  const orgs = await query<Organization>(`select * from organizations where type in ('retailer','provider') order by type, name`);
  const providerIds = orgs.filter((o) => o.type === "provider").map((o) => o.id);
  const ratings = await getProviderRatingSummaries(providerIds);

  const rows = orgs.map((o) => ({
    ...o,
    ratingAvg: ratings.get(o.id)?.avg ?? null,
    ratingCount: ratings.get(o.id)?.count ?? 0,
  }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Organizations</h1>
      <OrganizationsList orgs={rows} />
    </div>
  );
}

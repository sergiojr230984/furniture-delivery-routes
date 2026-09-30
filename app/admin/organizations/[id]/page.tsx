import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { setOrgStatusAction, reviewDocumentAction } from "../actions";
import { formatDate } from "@/lib/time";
import type { Organization, ProviderDocument, ProviderVehicle, CrewMember } from "@/lib/types";

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("platform_admin", "dispatcher");

  const org = await queryOne<Organization>(`select * from organizations where id = $1`, [id]);
  if (!org) throw new Error("Not found");

  const isProvider = org.type === "provider";
  const docs = isProvider ? await query<ProviderDocument>(`select * from provider_documents where org_id = $1 order by created_at desc`, [id]) : [];
  const vehicles = isProvider ? await query<ProviderVehicle>(`select * from provider_vehicles where org_id = $1`, [id]) : [];
  const crew = isProvider ? await query<CrewMember>(`select * from crew_members where org_id = $1`, [id]) : [];
  const users = await query<{ full_name: string; email: string; role: string }>(`select full_name, email, role from users where org_id = $1`, [id]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{org.name}</h1>
          <p className="text-sm text-navy-500">{org.type} · {org.status.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-2">
          {org.status !== "active" && (
            <form action={setOrgStatusAction.bind(null, org.id, "active")}>
              <button type="submit" className="btn-primary">
                Approve
              </button>
            </form>
          )}
          {org.status === "active" && (
            <form action={setOrgStatusAction.bind(null, org.id, "suspended")}>
              <button type="submit" className="btn-danger">
                Suspend
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Users</h2>
        <ul className="text-sm text-navy-600">
          {users.map((u, i) => (
            <li key={i}>{u.full_name} — {u.email} ({u.role})</li>
          ))}
        </ul>
      </div>

      {isProvider && (
        <>
          <div className="card p-4">
            <h2 className="mb-2 font-semibold text-navy-800">Documents</h2>
            {docs.length === 0 && <p className="text-sm text-navy-500">No documents uploaded.</p>}
            <ul className="space-y-3">
              {docs.map((d) => (
                <li key={d.id} className="border-b border-navy-50 pb-3 last:border-0">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {d.doc_type.replace(/_/g, " ")} {d.expires_at && `— expires ${formatDate(d.expires_at)}`}
                    </span>
                    <span className="text-xs uppercase text-navy-400">{d.status.replace(/_/g, " ")}</span>
                  </div>
                  {d.status === "pending_review" && (
                    <form action={reviewDocumentAction.bind(null, d.id, org.id)} className="mt-2 flex items-center gap-2">
                      <input className="input" name="notes" placeholder="Review notes (optional)" />
                      <button formAction={reviewDocumentAction.bind(null, d.id, org.id)} name="status" value="approved" className="btn-primary shrink-0">
                        Approve
                      </button>
                      <button formAction={reviewDocumentAction.bind(null, d.id, org.id)} name="status" value="rejected" className="btn-danger shrink-0">
                        Reject
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="mb-2 font-semibold text-navy-800">Vehicles</h2>
            <ul className="text-sm text-navy-600">
              {vehicles.map((v) => (
                <li key={v.id}>{v.name} — {v.payload_lbs} lbs, {v.max_jobs_per_day} jobs/day ({v.status})</li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h2 className="mb-2 font-semibold text-navy-800">Crew</h2>
            <ul className="text-sm text-navy-600">
              {crew.map((c) => (
                <li key={c.id}>{c.full_name} {c.can_assemble && "(assembly)"}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

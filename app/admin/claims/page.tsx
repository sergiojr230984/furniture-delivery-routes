import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { resolveClaimAction } from "./actions";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

export default async function AdminClaimsPage() {
  await requireRole("platform_admin", "dispatcher");
  const claims = await query<{
    id: string;
    booking_number: string;
    retailer_name: string;
    status: string;
    description: string;
    requested_amount: string | null;
    created_at: string;
  }>(
    `select c.id, b.booking_number, o.name as retailer_name, c.status, c.description, c.requested_amount, c.created_at
     from claims c join bookings b on b.id = c.booking_id join organizations o on o.id = b.retailer_org_id
     order by c.created_at desc`
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-navy-900">Claims</h1>
      <div className="space-y-3">
        {claims.length === 0 && <p className="text-navy-500">No claims filed.</p>}
        {claims.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-navy-800">{c.booking_number} — {c.retailer_name}</span>
              <span className="badge border-navy-100 bg-navy-50 text-navy-600">{c.status.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-1 text-sm text-navy-600">{c.description}</p>
            <p className="text-xs text-navy-400">
              Requested {c.requested_amount ? formatMoney(c.requested_amount) : "—"} · {formatDateTime(c.created_at)}
            </p>
            {c.status === "open" && (
              <form action={resolveClaimAction.bind(null, c.id)} className="mt-3 flex flex-wrap items-center gap-2">
                <input className="input w-32" name="adjustmentAmount" type="number" step="0.01" placeholder="Adjustment $" />
                <input className="input flex-1" name="notes" placeholder="Decision notes" />
                <button formAction={resolveClaimAction.bind(null, c.id)} name="decision" value="approved" className="btn-primary shrink-0">
                  Approve
                </button>
                <button formAction={resolveClaimAction.bind(null, c.id)} name="decision" value="denied" className="btn-danger shrink-0">
                  Deny
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

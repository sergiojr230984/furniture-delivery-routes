import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { setContributionFloorAction, createRetailerAction } from "./actions";
import { currentAppMode } from "@/lib/constants";
import { isStripeConfigured } from "@/lib/payments";
import { formatMoney } from "@/lib/money";
import type { Organization } from "@/lib/types";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("platform_admin");
  const { error } = await searchParams;
  const providers = await query<Organization>(`select * from organizations where type = 'provider' order by is_internal_fleet desc, name`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Settings</h1>

      <div className="card p-4 text-sm">
        <h2 className="mb-2 font-semibold text-navy-800">Operating mode</h2>
        <p>
          <code className="font-mono">APP_MODE={currentAppMode()}</code> (set via environment variable — restart to
          change)
        </p>
        <p className="mt-1 text-navy-500">
          Payments: {isStripeConfigured() ? "Stripe test mode configured" : "Demo adapter (no real charges)"}
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold text-navy-800">Contribution floor per provider</h2>
        <p className="mb-3 text-xs text-navy-400">
          Offers paying below this amount should be flagged before being sent (enforced at offer-creation review, not
          automatically blocked in this build).
        </p>
        <div className="space-y-2">
          {providers.map((p) => (
            <form key={p.id} action={setContributionFloorAction.bind(null, p.id)} className="flex items-center gap-3 text-sm">
              <span className="w-56 shrink-0 text-navy-700">{p.name}</span>
              <input className="input" name="amount" type="number" step="0.01" defaultValue={p.contribution_floor_amount ?? ""} placeholder="$ floor" />
              <button type="submit" className="btn-secondary shrink-0">
                Save
              </button>
              <span className="text-xs text-navy-400">current: {p.contribution_floor_amount ? formatMoney(p.contribution_floor_amount) : "none"}</span>
            </form>
          ))}
        </div>
      </div>

      <form action={createRetailerAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add a retailer organization</h2>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}
        <input className="input" name="name" placeholder="Retailer company name" required />
        <input className="input" name="ownerName" placeholder="Owner full name" />
        <input className="input" name="email" type="email" placeholder="Owner email" required />
        <input className="input" name="password" type="password" placeholder="Temporary password (8+ chars)" required minLength={8} />
        <button type="submit" className="btn-primary w-full">
          Create retailer
        </button>
      </form>
    </div>
  );
}

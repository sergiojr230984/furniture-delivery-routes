import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { createDraftRuleSetAction, activateRuleSetAction } from "./actions";
import { formatDate } from "@/lib/time";
import type { PricingRuleSet } from "@/lib/types";

export default async function AdminPricingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole("platform_admin");
  const { error } = await searchParams;
  const ruleSets = await query<PricingRuleSet>(`select * from pricing_rule_sets order by version desc`);
  const active = ruleSets.find((r) => r.status === "active");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Pricing</h1>
      <p className="text-sm text-navy-500">{active?.label} — labeled &quot;Example&quot; until you configure real Miami market rates.</p>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}

      <div className="card divide-y divide-navy-100">
        {ruleSets.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-medium text-navy-800">v{r.version} — {r.label}</div>
              <div className="text-xs text-navy-400">
                {r.status} {r.activated_at && `· activated ${formatDate(r.activated_at)}`}
              </div>
            </div>
            {r.status === "draft" && (
              <form action={activateRuleSetAction.bind(null, r.id)}>
                <button type="submit" className="btn-primary">
                  Activate
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <form action={createDraftRuleSetAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Create new draft rule set</h2>
        <input className="input" name="label" placeholder="Label (e.g. 'v2 — updated stairs fee')" required />
        <textarea
          className="input font-mono text-xs"
          name="config"
          rows={16}
          defaultValue={active ? JSON.stringify(active.config, null, 2) : "{}"}
        />
        <p className="text-xs text-navy-400">
          Edit the JSON above (start from the current active config) and save as a new draft version. Draft versions
          have no effect until activated — activating archives the previously active version, and every already-quoted
          booking keeps the rule-set snapshot it was quoted under.
        </p>
        <button type="submit" className="btn-secondary w-full">
          Save as new draft
        </button>
      </form>
    </div>
  );
}

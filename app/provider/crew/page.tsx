import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { addCrewMemberAction, toggleCrewActiveAction, provisionCrewLoginAction } from "./actions";
import type { CrewMember } from "@/lib/types";

export default async function ProviderCrewPage({ searchParams }: { searchParams: Promise<{ created?: string; temp?: string }> }) {
  const user = await requireRole("provider_owner");
  const { created, temp } = await searchParams;
  const crew = await query<CrewMember>(`select * from crew_members where org_id = $1 order by created_at`, [user.org_id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Crew</h1>

      {created && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Login created for <strong>{created}</strong>. Temporary password: <code className="font-mono">{temp}</code>{" "}
          (share this with the crew member directly — in production this would be sent by email/SMS instead).
        </div>
      )}

      <div className="card divide-y divide-navy-100">
        {crew.map((c) => (
          <div key={c.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-navy-800">{c.full_name}</div>
                <div className="text-xs text-navy-400">{c.phone} {c.can_assemble && "· Can assemble"}</div>
              </div>
              <form action={toggleCrewActiveAction.bind(null, c.id, !c.active)}>
                <button type="submit" className={c.active ? "btn-secondary" : "btn-primary"}>
                  {c.active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </div>
            {!c.user_id && (
              <form action={provisionCrewLoginAction.bind(null, c.id)} className="mt-2 flex gap-2">
                <input className="input" name="email" type="email" placeholder="Email for mobile login" required />
                <button type="submit" className="btn-secondary shrink-0">
                  Create login
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <form action={addCrewMemberAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add crew member</h2>
        <input className="input" name="fullName" placeholder="Full name" required />
        <input className="input" name="phone" placeholder="Phone" />
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="canAssemble" /> Can perform assembly
        </label>
        <button type="submit" className="btn-primary w-full">
          Add crew member
        </button>
      </form>
    </div>
  );
}

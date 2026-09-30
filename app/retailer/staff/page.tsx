import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { addStaffAction, toggleStaffActiveAction } from "./actions";

export default async function RetailerStaffPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireRole("retailer_owner");
  const { error } = await searchParams;
  const staff = await query<{ id: string; full_name: string; email: string; active: boolean }>(
    `select id, full_name, email, active from users where org_id = $1 and role = 'retailer_staff' order by full_name`,
    [user.org_id]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Staff</h1>
      <div className="card divide-y divide-navy-100">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-navy-800">{s.full_name}</div>
              <div className="text-xs text-navy-400">{s.email}</div>
            </div>
            <form action={toggleStaffActiveAction.bind(null, s.id, !s.active)}>
              <button type="submit" className={s.active ? "btn-secondary" : "btn-primary"}>
                {s.active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <form action={addStaffAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add salesperson</h2>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}
        <input className="input" name="fullName" placeholder="Full name" required />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <input className="input" name="password" type="password" placeholder="Temporary password (8+ chars)" required minLength={8} />
        <button type="submit" className="btn-primary w-full">
          Add salesperson
        </button>
      </form>
    </div>
  );
}

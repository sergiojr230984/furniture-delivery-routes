import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { listPendingInvites, inviteUrl } from "@/lib/invites";
import { formatDateTime } from "@/lib/time";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import CopyButton from "@/components/CopyButton";
import { inviteStaffAction, revokeInviteAction, toggleStaffActiveAction } from "./actions";

export default async function RetailerStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireRole("retailer_owner");
  const { error, success } = await searchParams;
  const staff = await query<{ id: string; full_name: string; email: string; active: boolean }>(
    `select id, full_name, email, active from users where org_id = $1 and role = 'retailer_staff' order by full_name`,
    [user.org_id]
  );
  const pendingInvites = await listPendingInvites(user.org_id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Staff</h1>

      <Flash error={error && decodeURIComponent(error)} success={success && decodeURIComponent(success)} />

      <div className="card divide-y divide-navy-100">
        {staff.length === 0 && <p className="p-4 text-sm text-navy-500">No staff yet.</p>}
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-navy-800">{s.full_name}</div>
              <div className="text-xs text-navy-400">{s.email}</div>
            </div>
            <form action={toggleStaffActiveAction.bind(null, s.id, !s.active)}>
              <SubmitButton className={s.active ? "btn-secondary" : "btn-primary"} pendingText="Saving…">
                {s.active ? "Deactivate" : "Activate"}
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>

      {pendingInvites.length > 0 && (
        <div className="card divide-y divide-navy-100">
          <h2 className="p-4 pb-2 font-semibold text-navy-800">Pending invites</h2>
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-navy-800">{inv.full_name || inv.email}</div>
                  <div className="text-xs text-navy-400">
                    {inv.email} · expires {formatDateTime(inv.expires_at)}
                  </div>
                </div>
                <form action={revokeInviteAction.bind(null, inv.id)}>
                  <SubmitButton className="btn-secondary !px-2 !py-1 text-xs" pendingText="Revoking…">
                    Revoke
                  </SubmitButton>
                </form>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
                <span className="flex-1">
                  No email provider is configured in this environment — share this link directly:{" "}
                  <span className="break-all font-mono text-navy-700">{inviteUrl(inv.token)}</span>
                </span>
                <CopyButton text={inviteUrl(inv.token)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={inviteStaffAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Invite someone</h2>
        <input className="input" name="fullName" placeholder="Full name" required />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <SubmitButton pendingText="Sending…">Send invite</SubmitButton>
        <p className="text-xs text-navy-400">They&apos;ll get a link to set their own password — no temporary password to hand off.</p>
      </form>
    </div>
  );
}

import { resolveInvite } from "@/lib/invites";
import WordMark from "@/components/WordMark";
import { acceptInviteAction } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await resolveInvite(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <WordMark />
        </div>

        {!invite ? (
          <div className="card p-6 text-sm text-navy-600">
            <h1 className="mb-2 text-lg font-semibold text-navy-900">Invite not found</h1>
            <p>This invite link is invalid, expired, or has already been used. Ask whoever invited you to send a new one.</p>
          </div>
        ) : (
          <form action={acceptInviteAction.bind(null, token)} className="card space-y-4 p-6">
            <div>
              <h1 className="text-lg font-semibold text-navy-900">Set your password</h1>
              <p className="text-sm text-navy-500">
                {invite.full_name ? `Welcome, ${invite.full_name}` : "Welcome"} — finish setting up your login for {invite.email}.
              </p>
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input className="input" id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-primary w-full">
              Set password &amp; sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

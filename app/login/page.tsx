import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homePathForRole, currentAppMode } from "@/lib/constants";
import { getLocale, t } from "@/lib/i18n";
import { loginAction } from "./actions";
import WordMark from "@/components/WordMark";
import LocaleSwitch from "@/components/LocaleSwitch";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  const { error } = await searchParams;
  const mode = currentAppMode();
  const locale = await getLocale();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <WordMark />
          <LocaleSwitch locale={locale} />
        </div>

        <form action={loginAction} className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold text-navy-900">{t(locale, "login_title")}</h1>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t(locale, "login_error")}</div>
          )}

          <div>
            <label className="label" htmlFor="email">
              {t(locale, "login_email")}
            </label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t(locale, "login_password")}
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {t(locale, "login_submit")}
          </button>
        </form>

        {mode === "demo" && (
          <div className="mt-6 rounded-lg border border-navy-100 bg-white p-4 text-xs text-navy-600">
            <p className="mb-2 font-semibold text-navy-800">Demo accounts (password: demo1234)</p>
            <ul className="space-y-1">
              <li>admin@belliza.demo — Platform admin</li>
              <li>dispatch@belliza.demo — Dispatcher</li>
              <li>owner@casamiami.demo — Retailer owner (Casa Miami Furniture)</li>
              <li>sales@casamiami.demo — Retailer salesperson</li>
              <li>owner@sunshinemovers.demo — External provider owner</li>
              <li>crew@sunshinemovers.demo — Crew member</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

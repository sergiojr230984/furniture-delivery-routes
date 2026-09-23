import Link from "next/link";
import { LogOut } from "lucide-react";
import WordMark from "./WordMark";
import LocaleSwitch from "./LocaleSwitch";
import { signOutAction } from "@/app/actions";
import { currentAppMode, ROLE_LABELS } from "@/lib/constants";
import type { Locale, Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
}

export default function AppShell({
  navItems,
  locale,
  userName,
  role,
  children,
}: {
  navItems: NavItem[];
  locale: Locale;
  userName: string;
  role: Role;
  children: React.ReactNode;
}) {
  const mode = currentAppMode();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {mode !== "marketplace" && (
        <div className="w-full bg-navy-900 px-4 py-1.5 text-center text-xs font-medium text-white md:hidden">
          {mode === "demo" ? "DEMO MODE — simulated data, no real charges" : "INTERNAL PILOT — Belliza stores & crew only"}
        </div>
      )}

      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-navy-100 bg-white md:flex">
        <div className="border-b border-navy-100 px-5 py-4">
          <Link href="/">
            <WordMark size="sm" />
          </Link>
          <div className="mt-1 text-xs text-navy-400">{ROLE_LABELS[role]}</div>
        </div>
        {mode !== "marketplace" && (
          <div className="bg-navy-900 px-4 py-1.5 text-center text-xs font-medium text-white">
            {mode === "demo" ? "DEMO MODE — simulated data" : "INTERNAL PILOT"}
          </div>
        )}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50 hover:text-navy-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-navy-100 p-3">
          <div className="mb-2 truncate px-3 text-sm text-navy-500">{userName}</div>
          <div className="flex items-center justify-between px-3">
            <LocaleSwitch locale={locale} />
            <form action={signOutAction}>
              <button type="submit" className="btn-ghost !px-2 !py-1 text-xs">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3 md:hidden">
        <Link href="/">
          <WordMark size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitch locale={locale} />
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost !p-2">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Mobile nav strip */}
      <nav className="flex gap-1 overflow-x-auto border-b border-navy-100 bg-white px-3 py-2 md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-navy-100 px-3 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="min-w-0 flex-1 bg-slate-50 p-4 md:p-8">{children}</main>
    </div>
  );
}

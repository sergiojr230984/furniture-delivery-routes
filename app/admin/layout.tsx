import { requireRole } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";
import AppShell, { type NavItem } from "@/components/AppShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("platform_admin", "dispatcher");
  const locale = await getLocale();
  const nav: NavItem[] = [
    { href: "/admin/dashboard", label: t(locale, "nav_dashboard") },
    { href: "/admin/dispatch", label: t(locale, "nav_dispatch") },
    { href: "/admin/bookings", label: t(locale, "nav_bookings") },
    { href: "/admin/organizations", label: t(locale, "nav_organizations") },
    { href: "/admin/pricing", label: t(locale, "nav_pricing") },
    { href: "/admin/ledger", label: t(locale, "nav_ledger") },
    { href: "/admin/claims", label: t(locale, "nav_claims") },
    { href: "/admin/notifications", label: t(locale, "nav_notifications") },
    { href: "/admin/settings", label: t(locale, "nav_settings") },
  ];
  return (
    <AppShell navItems={nav} locale={locale} userName={user.full_name} role={user.role}>
      {children}
    </AppShell>
  );
}

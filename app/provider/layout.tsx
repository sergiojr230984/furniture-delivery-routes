import { requireRole } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";
import AppShell, { type NavItem } from "@/components/AppShell";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("provider_owner");
  const locale = await getLocale();
  const nav: NavItem[] = [
    { href: "/provider/dashboard", label: t(locale, "nav_dashboard") },
    { href: "/provider/offers", label: t(locale, "nav_offers") },
    { href: "/provider/routes", label: t(locale, "nav_routes") },
    { href: "/provider/vehicles", label: t(locale, "nav_vehicles") },
    { href: "/provider/crew", label: t(locale, "nav_crew") },
    { href: "/provider/documents", label: t(locale, "nav_documents") },
    { href: "/provider/earnings", label: t(locale, "nav_earnings") },
  ];
  return (
    <AppShell navItems={nav} locale={locale} userName={user.full_name} role={user.role}>
      {children}
    </AppShell>
  );
}

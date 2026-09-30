import { requireRole } from "@/lib/auth";
import { getLocale, t } from "@/lib/i18n";
import AppShell, { type NavItem } from "@/components/AppShell";

export default async function RetailerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const locale = await getLocale();
  const nav: NavItem[] = [
    { href: "/retailer/dashboard", label: t(locale, "nav_dashboard") },
    { href: "/retailer/book", label: t(locale, "nav_book") },
    { href: "/retailer/bookings", label: t(locale, "nav_bookings") },
    { href: "/retailer/warehouse-collection", label: t(locale, "nav_warehouse_collection") },
    { href: "/retailer/products", label: t(locale, "nav_products") },
    { href: "/retailer/locations", label: t(locale, "nav_locations") },
    ...(user.role === "retailer_owner" ? [{ href: "/retailer/staff", label: t(locale, "nav_staff") }] : []),
    { href: "/retailer/spending", label: t(locale, "nav_spending") },
  ];
  return (
    <AppShell navItems={nav} locale={locale} userName={user.full_name} role={user.role}>
      {children}
    </AppShell>
  );
}

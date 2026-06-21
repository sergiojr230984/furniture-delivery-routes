import Link from "next/link";
import { Truck } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import Nav from "@/components/Nav";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) / top bar (mobile) */}
      <aside className="border-b border-gray-200 bg-white lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <Link href="/" className="block text-base font-bold leading-tight">
              FleetRoute
            </Link>
            <p className="text-xs text-gray-400">Delivery & routes</p>
          </div>
        </div>
        <Nav role={profile.role} />
        <div className="mt-auto hidden border-t border-gray-200 p-4 lg:block">
          <p className="truncate text-sm font-medium">
            {profile.full_name || profile.email}
          </p>
          <p className="mb-3 text-xs text-gray-400">
            {ROLE_LABELS[profile.role]}
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <p className="text-sm font-medium">
            {profile.full_name || profile.email}
          </p>
          <SignOutButton />
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

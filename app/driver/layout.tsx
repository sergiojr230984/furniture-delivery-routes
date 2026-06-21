import Link from "next/link";
import { Truck } from "lucide-react";
import { getProfile } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/driver" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Truck className="h-4 w-4" />
          </div>
          <span className="font-bold">My Deliveries</span>
        </Link>
        <SignOutButton />
      </header>
      <main className="p-4">{children}</main>
      <p className="pb-6 text-center text-xs text-gray-400">
        {profile.full_name || profile.email}
      </p>
    </div>
  );
}

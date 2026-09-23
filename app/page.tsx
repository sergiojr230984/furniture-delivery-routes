import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homePathForRole } from "@/lib/constants";
import WordMark from "@/components/WordMark";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-6 text-center">
      <WordMark size="lg" light />
      <p className="mt-4 max-w-md text-navy-100">
        See a price. Choose an available window. Book, pay and follow your furniture delivery — no dispatcher call
        required.
      </p>
      <Link href="/login" className="btn-primary mt-8 px-8">
        Sign in
      </Link>
      <p className="mt-6 max-w-sm text-xs text-navy-300">
        Miami furniture wholesale &amp; retail delivery — internal crew and approved independent delivery
        providers.
      </p>
      <Link href="/providers/apply" className="mt-4 text-xs text-orange-300 underline">
        Own a delivery vehicle &amp; crew? Apply as a provider
      </Link>
    </div>
  );
}

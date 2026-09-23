import { requireRole } from "@/lib/auth";
import { signOutAction } from "@/app/actions";
import WordMark from "@/components/WordMark";
import { LogOut } from "lucide-react";

export default async function CrewLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("crew_member");
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3">
        <WordMark size="sm" />
        <div className="flex items-center gap-3 text-sm text-navy-500">
          <span className="hidden sm:inline">{user.full_name}</span>
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost !p-2">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4">{children}</main>
    </div>
  );
}

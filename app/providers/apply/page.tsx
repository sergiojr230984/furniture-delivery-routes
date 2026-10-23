import WordMark from "@/components/WordMark";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { applyAsProviderAction } from "./actions";
import { currentAppMode } from "@/lib/constants";

export default async function ApplyProviderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const mode = currentAppMode();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <WordMark />
        </div>
        <h1 className="mb-1 text-xl font-bold text-navy-900">Become a delivery provider</h1>
        <p className="mb-4 text-sm text-navy-500">
          Bring your own vehicle and two-person crew and get offered furniture delivery jobs across Miami.
        </p>

        {mode === "pilot" ? (
          <div className="card p-5 text-sm text-navy-600">Provider onboarding is currently disabled — Belliza is running an internal pilot.</div>
        ) : (
          <form action={applyAsProviderAction} className="card space-y-4 p-5">
            <Flash error={error && decodeURIComponent(error)} />
            <input className="input" name="companyName" placeholder="Company name" required />
            <input className="input" name="contactName" placeholder="Your name" required />
            <input className="input" name="email" type="email" placeholder="Email" required />
            <input className="input" name="phone" placeholder="Phone" />
            <input className="input" name="serviceArea" placeholder="Service area (e.g. Miami-Dade County)" />
            <input className="input" name="password" type="password" placeholder="Choose a password (8+ characters)" required minLength={8} />
            <SubmitButton pendingText="Submitting…">Apply</SubmitButton>
            <p className="text-xs text-navy-400">
              After applying you can upload your documents and add vehicles/crew, but Belliza reviews and approves
              every provider before you receive job offers.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

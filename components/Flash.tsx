import { CheckCircle2, AlertCircle } from "lucide-react";

// Consistent success/error banner, reading the ?error=/?success= query-param
// convention already used throughout this app. Previously every page wrote
// its own one-off red banner for errors and had *no* success feedback at
// all — a save just silently re-rendered the page. This is a server
// component (no client JS) since it only needs to render a prop.
export default function Flash({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const isError = !!error;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isError ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{isError ? error : success}</span>
    </div>
  );
}

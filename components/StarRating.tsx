// Read-only star display — purely presentational, no interactivity needed
// (rating *input* is a plain <select>, matching this app's existing
// minimal-JS form style; see the "Rate this delivery" form).
export default function StarRating({ value, size = "text-base" }: { value: number; size?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`${size} tracking-tight text-amber-500`} aria-label={`${value} out of 5 stars`}>
      {"★".repeat(rounded)}
      <span className="text-navy-200">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

// Configurable text wordmark (no external image asset). Swap the two spans'
// text or the env var NEXT_PUBLIC_APP_NAME to rebrand without touching
// layout code elsewhere.
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Belliza Delivery";

export default function WordMark({ size = "md", light = false }: { size?: "sm" | "md" | "lg"; light?: boolean }) {
  const [first, ...rest] = APP_NAME.split(" ");
  const restText = rest.join(" ");
  const sizeClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <span className={`font-extrabold tracking-tight ${sizeClass}`}>
      <span className={light ? "text-white" : "text-navy-800"}>{first}</span>{" "}
      {restText && <span className="text-orange-500">{restText}</span>}
    </span>
  );
}

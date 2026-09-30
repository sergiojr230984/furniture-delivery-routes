const STEPS = [
  { key: "pickup", label: "Pickup" },
  { key: "items", label: "Furniture" },
  { key: "destination", label: "Destination" },
  { key: "service", label: "Service" },
  { key: "quote", label: "Quote" },
] as const;

export default function BookingWizardSteps({ current }: { current: (typeof STEPS)[number]["key"] }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-6 flex gap-1 overflow-x-auto text-xs">
      {STEPS.map((s, i) => (
        <li
          key={s.key}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${
            i === currentIdx
              ? "border-orange-500 bg-orange-50 text-orange-700"
              : i < currentIdx
                ? "border-navy-100 bg-navy-50 text-navy-500"
                : "border-navy-100 text-navy-300"
          }`}
        >
          <span>{i + 1}</span>
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

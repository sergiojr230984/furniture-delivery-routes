import { STATUS_COLORS, STATUS_LABELS, type DeliveryStatus } from "@/lib/constants";

export default function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

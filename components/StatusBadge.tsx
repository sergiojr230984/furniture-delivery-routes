import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/constants";

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge ${BOOKING_STATUS_COLORS[status]}`}>{BOOKING_STATUS_LABELS[status]}</span>;
}

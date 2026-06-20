import type { RouteStatus, DeliveryStatus, DriverStatus } from '@/lib/types'

type Status = RouteStatus | DeliveryStatus | DriverStatus

const styles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-100 text-slate-600',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rescheduled: 'bg-purple-100 text-purple-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-slate-100 text-slate-600',
}

const labels: Record<string, string> = {
  in_progress: 'In Progress',
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
  delivered: 'Delivered',
  failed: 'Failed',
  rescheduled: 'Rescheduled',
  active: 'Active',
  inactive: 'Inactive',
}

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

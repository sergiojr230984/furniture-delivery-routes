"use client";

import { updateOrderStatus } from "@/app/(dashboard)/deliveries/actions";
import {
  DELIVERY_STATUSES,
  STATUS_LABELS,
  type DeliveryStatus,
} from "@/lib/constants";

// Dispatcher control to move an order through the delivery statuses.
export default function StatusUpdater({
  id,
  current,
}: {
  id: string;
  current: DeliveryStatus;
}) {
  return (
    <form action={updateOrderStatus} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor="status">
          Update status
        </label>
        <select id="status" name="status" defaultValue={current} className="input">
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s as DeliveryStatus]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note (optional)
        </label>
        <input id="note" name="note" className="input" placeholder="Reason / context" />
      </div>
      <button type="submit" className="btn-primary w-full">
        Save status
      </button>
    </form>
  );
}

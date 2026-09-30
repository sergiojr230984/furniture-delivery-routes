import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { scheduleCollectionAction, cancelCollectionAction } from "./actions";
import { formatDateTime } from "@/lib/time";
import type { WarehouseCollectionAppointment, BellizaWarehouse } from "@/lib/types";

export default async function WarehouseCollectionPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const warehouses = await query<BellizaWarehouse>(`select * from belliza_warehouses order by name`);
  const appointments = await query<WarehouseCollectionAppointment>(
    `select * from warehouse_collection_appointments where retailer_org_id = $1 order by scheduled_at desc`,
    [user.org_id]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Warehouse Collection</h1>
        <p className="mt-1 text-sm text-navy-500">
          For retailers using their own driver to pick up from the Belliza warehouse — a simple appointment, kept
          entirely separate from dispatched delivery jobs.
        </p>
      </div>

      <div className="card divide-y divide-navy-100">
        {appointments.length === 0 && <p className="p-5 text-navy-500">No collection appointments scheduled.</p>}
        {appointments.map((a) => (
          <div key={a.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-medium text-navy-800">Order {a.order_number}</div>
              <div className="text-xs text-navy-400">
                {formatDateTime(a.scheduled_at)} · {a.driver_name} {a.vehicle_plate && `(${a.vehicle_plate})`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge border-navy-100 bg-navy-50 text-navy-600">{a.status}</span>
              {a.status === "scheduled" && (
                <form action={cancelCollectionAction.bind(null, a.id)}>
                  <button type="submit" className="btn-ghost text-xs text-red-500">
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <form action={scheduleCollectionAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Schedule a collection</h2>
        <select className="input" name="warehouseId" required>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <input className="input" name="orderNumber" placeholder="Belliza order number" required />
        <input className="input" name="scheduledAt" type="datetime-local" required />
        <input className="input" name="driverName" placeholder="Your driver's name" />
        <input className="input" name="driverPhone" placeholder="Driver phone" />
        <input className="input" name="vehiclePlate" placeholder="Vehicle plate" />
        <button type="submit" className="btn-primary w-full">
          Schedule
        </button>
      </form>
    </div>
  );
}

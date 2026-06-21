import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import {
  DELIVERY_STATUSES,
  STATUS_LABELS,
  ORDER_TYPE_LABELS,
} from "@/lib/constants";
import type { DeliveryStatus } from "@/lib/constants";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayISO();
  const status = params.status || "";

  const supabase = await createClient();
  let query = supabase
    .from("delivery_orders")
    .select("*, customer:customers(name)")
    .eq("scheduled_date", date)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data: orders } = await query;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Deliveries</h1>
        <Link href="/deliveries/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New delivery
        </Link>
      </div>

      {/* Filters */}
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            name="date"
            defaultValue={date}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="input"
          >
            <option value="">All statuses</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as DeliveryStatus]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Apply
        </button>
      </form>

      {/* List */}
      <div className="card overflow-hidden">
        {!orders || orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No deliveries for {date}.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/deliveries/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{o.order_number}</span>
                    <span className="text-xs text-gray-400">
                      {ORDER_TYPE_LABELS[o.order_type as "delivery" | "pickup"]}
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-600">
                    {o.customer?.name || o.contact_name || "—"}
                    {o.city ? ` · ${o.city}` : ""}
                  </p>
                </div>
                <StatusBadge status={o.status as DeliveryStatus} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

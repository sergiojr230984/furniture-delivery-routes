import Link from "next/link";
import { ChevronRight, MapPin, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import LocationSharer from "@/components/LocationSharer";
import { ROUTE_STATUS_LABELS, type DeliveryStatus, type RouteStatus } from "@/lib/constants";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DriverHome({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayISO();
  const profile = await getProfile();
  const supabase = await createClient();

  // Which driver records belong to this login?
  const { data: myDrivers } = await supabase
    .from("drivers")
    .select("id")
    .eq("profile_id", profile.id);
  const myIds = (myDrivers ?? []).map((d) => d.id);

  let routes: {
    id: string;
    name: string;
    status: string;
    route_stops: {
      id: string;
      stop_order: number;
      completed_at: string | null;
      delivery_order: {
        order_number: string | null;
        status: string;
        city: string | null;
        contact_name: string | null;
        customer: { name: string | null } | { name: string | null }[] | null;
      } | null;
    }[];
  }[] = [];

  if (myIds.length > 0) {
    const orList = myIds.join(",");
    const { data } = await supabase
      .from("routes")
      .select(
        "id, name, status, route_stops(id, stop_order, completed_at, delivery_order:delivery_orders(order_number, status, city, contact_name, customer:customers(name)))"
      )
      .eq("route_date", date)
      .or(`driver_id.in.(${orList}),helper_id.in.(${orList})`)
      .order("created_at");
    routes = (data ?? []) as unknown as typeof routes;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Today&apos;s routes</h1>
        <form method="get">
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </form>
      </div>

      <LocationSharer driverId={myIds[0] ?? null} routeId={routes[0]?.id ?? null} />

      {myIds.length === 0 && (
        <p className="card p-4 text-sm text-gray-500">
          Your login isn&apos;t linked to a driver record yet. Ask your dispatcher
          to add your email on the Drivers screen.
        </p>
      )}

      {myIds.length > 0 && routes.length === 0 && (
        <p className="card flex items-center gap-2 p-4 text-sm text-gray-500">
          <Calendar className="h-4 w-4" /> No routes assigned for {date}.
        </p>
      )}

      {routes.map((r) => {
        const stops = [...r.route_stops].sort((a, b) => a.stop_order - b.stop_order);
        return (
          <div key={r.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <span className="font-semibold">{r.name}</span>
              <span className="text-xs text-gray-500">
                {ROUTE_STATUS_LABELS[r.status as RouteStatus]}
              </span>
            </div>
            <ul className="divide-y divide-gray-100">
              {stops.map((s, idx) => {
                const cust = s.delivery_order?.customer;
                const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name;
                return (
                  <li key={s.id}>
                    <Link href={`/driver/stops/${s.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {custName || s.delivery_order?.contact_name || "—"}
                        </p>
                        <p className="flex items-center gap-1 truncate text-sm text-gray-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {s.delivery_order?.city || s.delivery_order?.order_number}
                        </p>
                      </div>
                      {s.delivery_order?.status && (
                        <StatusBadge status={s.delivery_order.status as DeliveryStatus} />
                      )}
                      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                    </Link>
                  </li>
                );
              })}
              {stops.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-500">No stops on this route.</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

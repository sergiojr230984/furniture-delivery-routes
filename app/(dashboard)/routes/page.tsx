import Link from "next/link";
import { Map, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ROUTE_STATUS_LABELS, type RouteStatus } from "@/lib/constants";
import { createRoute } from "./actions";
import type { Vehicle, Driver } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayISO();
  const supabase = await createClient();

  const [routesRes, vehiclesRes, driversRes] = await Promise.all([
    supabase
      .from("routes")
      .select("*, vehicle:vehicles(name), driver:drivers!routes_driver_id_fkey(full_name), route_stops(id)")
      .eq("route_date", date)
      .order("created_at"),
    supabase.from("vehicles").select("*").order("name"),
    supabase.from("drivers").select("*").eq("active", true).order("full_name"),
  ]);

  const vehicles = (vehiclesRes.data ?? []) as Vehicle[];
  const drivers = (driversRes.data ?? []) as Driver[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Routes</h1>
      </div>

      {/* Create route */}
      <form action={createRoute} className="card grid gap-4 p-5 sm:grid-cols-5">
        <h2 className="text-lg font-semibold sm:col-span-5">New route</h2>
        <div>
          <label className="label">Name</label>
          <input name="name" className="input" placeholder="North side AM" required />
        </div>
        <div>
          <label className="label">Date</label>
          <input name="route_date" type="date" className="input" defaultValue={date} required />
        </div>
        <div>
          <label className="label">Vehicle</label>
          <select name="vehicle_id" className="input" defaultValue="">
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Driver</label>
          <select name="driver_id" className="input" defaultValue="">
            <option value="">—</option>
            {drivers.filter((d) => d.crew_type === "driver").map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Helper</label>
          <select name="helper_id" className="input" defaultValue="">
            <option value="">—</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-5">
          <button type="submit" className="btn-primary">
            <Plus className="h-4 w-4" /> Create route
          </button>
        </div>
      </form>

      {/* Filter by date */}
      <form method="get" className="card flex items-end gap-3 p-4">
        <div>
          <label className="label">Show routes for</label>
          <input name="date" type="date" defaultValue={date} className="input" />
        </div>
        <button type="submit" className="btn-secondary">Apply</button>
      </form>

      {/* Route list */}
      <div className="card divide-y divide-gray-100">
        {(routesRes.data ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No routes for {date}.</p>
        ) : (
          (routesRes.data ?? []).map((r) => (
            <Link key={r.id} href={`/routes/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <Map className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-gray-500">
                    {r.vehicle?.name || "No vehicle"} ·{" "}
                    {r.driver?.full_name || "No driver"} ·{" "}
                    {r.route_stops?.length ?? 0} stops
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {ROUTE_STATUS_LABELS[r.status as RouteStatus]}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

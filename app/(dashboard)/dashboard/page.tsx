import Link from "next/link";
import { Package, Map, Truck, UserCog, Plus, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DELIVERY_STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { DeliveryStatus } from "@/lib/constants";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [orders, routesRes, vehiclesRes, driversRes, atRiskRes] = await Promise.all([
    supabase
      .from("delivery_orders")
      .select("status")
      .eq("scheduled_date", today),
    supabase
      .from("routes")
      .select("id", { count: "exact", head: true })
      .eq("route_date", today),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("status", "available"),
    supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    // Predictive ETA: stops projected to miss their delivery window today.
    supabase
      .from("route_stops")
      .select(
        "id, eta, predicted_delay_min, route:routes!inner(id, name, route_date), delivery_order:delivery_orders(order_number, status, customer:customers(name))"
      )
      .gt("predicted_delay_min", 0)
      .eq("route.route_date", today)
      .order("predicted_delay_min", { ascending: false })
      .limit(8),
  ]);

  type RelOrder = {
    order_number: string | null;
    status: string;
    customer: { name: string | null } | { name: string | null }[] | null;
  };
  type AtRiskRow = {
    id: string;
    eta: string | null;
    predicted_delay_min: number;
    route: { id: string; name: string } | { id: string; name: string }[] | null;
    delivery_order: RelOrder | RelOrder[] | null;
  };
  const atRiskRows = (atRiskRes.data ?? []) as unknown as AtRiskRow[];
  const atRisk = atRiskRows.filter((s) => {
    const o = Array.isArray(s.delivery_order) ? s.delivery_order[0] : s.delivery_order;
    return o && o.status !== "delivered" && o.status !== "failed";
  });

  const statusCounts: Record<string, number> = {};
  for (const s of DELIVERY_STATUSES) statusCounts[s] = 0;
  (orders.data ?? []).forEach((o: { status: string }) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });
  const totalToday = orders.data?.length ?? 0;

  const stats = [
    { label: "Deliveries today", value: totalToday, icon: Package, href: "/deliveries" },
    { label: "Routes today", value: routesRes.count ?? 0, icon: Map, href: "/routes" },
    { label: "Available vehicles", value: vehiclesRes.count ?? 0, icon: Truck, href: "/vehicles" },
    { label: "Active drivers", value: driversRes.count ?? 0, icon: UserCog, href: "/drivers" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500">Today — {today}</p>
        </div>
        <Link href="/deliveries/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New delivery
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="card p-4 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{s.label}</span>
                <Icon className="h-5 w-5 text-brand-600" />
              </div>
              <p className="mt-2 text-3xl font-bold">{s.value}</p>
            </Link>
          );
        })}
      </div>

      {/* Status breakdown */}
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">Today by status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {DELIVERY_STATUSES.map((s) => (
            <div
              key={s}
              className={`rounded-lg border p-3 text-center ${STATUS_COLORS[s as DeliveryStatus]}`}
            >
              <p className="text-2xl font-bold">{statusCounts[s]}</p>
              <p className="mt-1 text-xs font-medium">{STATUS_LABELS[s as DeliveryStatus]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive ETAs — at-risk deliveries */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">At-risk deliveries</h2>
          <span className="text-sm text-gray-400">predicted to miss their window</span>
        </div>
        {atRisk.length === 0 ? (
          <p className="text-sm text-gray-500">
            Everything is on track for today. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {atRisk.map((s) => {
              const rel = s.delivery_order;
              const o = Array.isArray(rel) ? rel[0] : rel;
              const route = Array.isArray(s.route) ? s.route[0] : s.route;
              const cust = o?.customer;
              const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/routes/${route?.id}`} className="font-medium hover:underline">
                      {o?.order_number}
                    </Link>
                    <p className="truncate text-sm text-gray-500">
                      {custName || "—"} · {route?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {s.eta && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3.5 w-3.5" /> {format(new Date(s.eta), "HH:mm")}
                      </span>
                    )}
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {s.predicted_delay_min}m late
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

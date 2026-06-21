// =====================================================================
//  Database-facing optimisation helpers (server-only).
//  Bridges the pure routing engine in lib/routing.ts to Supabase.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  optimizeRoute,
  combineDateTime,
  roadKm,
  type OptimizableStop,
  type GeoPoint,
} from "./routing";

type DB = SupabaseClient;

interface ItemRow {
  quantity: number | null;
  weight: number | null;
}

function orderWeight(items: ItemRow[] | null | undefined): number {
  if (!items) return 0;
  return items.reduce(
    (sum, it) => sum + (it.weight ?? 0) * (it.quantity ?? 1),
    0
  );
}

// Learns a typical on-site service time per customer from completed stops.
// This is what lets routes "get smarter with every delivery": as real
// arrival/completion times accumulate, future ETAs use measured durations.
export async function learnServiceMinutes(
  db: DB
): Promise<Map<string, number>> {
  const { data } = await db
    .from("route_stops")
    .select("arrived_at, completed_at, delivery_order:delivery_orders(customer_id)")
    .not("arrived_at", "is", null)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(500);

  const acc = new Map<string, { total: number; n: number }>();
  for (const row of data ?? []) {
    const rel = (row as { delivery_order: unknown }).delivery_order;
    const order = Array.isArray(rel) ? rel[0] : rel;
    const customerId = (order as { customer_id?: string } | null)?.customer_id;
    if (!customerId || !row.arrived_at || !row.completed_at) continue;
    const mins =
      (new Date(row.completed_at).getTime() -
        new Date(row.arrived_at).getTime()) /
      60_000;
    if (mins <= 0 || mins > 240) continue; // ignore obvious outliers
    const cur = acc.get(customerId) ?? { total: 0, n: 0 };
    cur.total += mins;
    cur.n += 1;
    acc.set(customerId, cur);
  }

  const result = new Map<string, number>();
  for (const [id, { total, n }] of acc) {
    result.set(id, Math.round(total / n));
  }
  return result;
}

interface SettingsRow {
  depot_lat: number | null;
  depot_lng: number | null;
  default_service_minutes: number;
  default_avg_speed_kmh: number;
}

async function getSettings(db: DB): Promise<SettingsRow> {
  const { data } = await db
    .from("org_settings")
    .select("depot_lat, depot_lng, default_service_minutes, default_avg_speed_kmh")
    .eq("id", 1)
    .single();
  return (
    data ?? {
      depot_lat: null,
      depot_lng: null,
      default_service_minutes: 15,
      default_avg_speed_kmh: 40,
    }
  );
}

// Re-sequences a route's stops optimally and writes back ETAs, per-stop
// distance, predicted delays and route totals.
export async function reoptimizeRoute(
  db: DB,
  routeId: string,
  reorder = true
): Promise<void> {
  const { data: route } = await db
    .from("routes")
    .select("*, vehicle:vehicles(avg_speed_kmh, avoid_tolls)")
    .eq("id", routeId)
    .single();
  if (!route) return;

  const settings = await getSettings(db);
  const learned = await learnServiceMinutes(db);

  const { data: stops } = await db
    .from("route_stops")
    .select(
      "id, stop_order, delivery_order:delivery_orders(id, customer_id, latitude, longitude, service_minutes, time_window_end, delivery_items(quantity, weight))"
    )
    .eq("route_id", routeId)
    .order("stop_order");

  if (!stops || stops.length === 0) {
    await db
      .from("routes")
      .update({ total_distance_km: 0, total_duration_min: 0, optimized_at: new Date().toISOString() })
      .eq("id", routeId);
    return;
  }

  const vehicle = Array.isArray(route.vehicle) ? route.vehicle[0] : route.vehicle;
  const avgSpeed = vehicle?.avg_speed_kmh ?? settings.default_avg_speed_kmh;
  const avoidTolls = route.avoid_tolls || vehicle?.avoid_tolls || false;
  const depot: GeoPoint | null =
    settings.depot_lat != null && settings.depot_lng != null
      ? { lat: settings.depot_lat, lng: settings.depot_lng }
      : null;
  const startAt =
    combineDateTime(route.route_date, route.start_time) ?? new Date();

  const optimizable: OptimizableStop[] = stops.map((s) => {
    const rel = (s as { delivery_order: unknown }).delivery_order;
    const order = (Array.isArray(rel) ? rel[0] : rel) as {
      customer_id: string | null;
      latitude: number | null;
      longitude: number | null;
      service_minutes: number | null;
      time_window_end: string | null;
      delivery_items: ItemRow[] | null;
    } | null;

    const point: GeoPoint | null =
      order?.latitude != null && order?.longitude != null
        ? { lat: order.latitude, lng: order.longitude }
        : null;

    const serviceMinutes =
      order?.service_minutes ??
      (order?.customer_id ? learned.get(order.customer_id) : undefined) ??
      settings.default_service_minutes;

    return {
      id: s.id,
      point,
      serviceMinutes,
      windowEnd: combineDateTime(route.route_date, order?.time_window_end ?? null),
      weight: orderWeight(order?.delivery_items),
    };
  });

  const result = optimizeRoute(optimizable, {
    depot,
    startAt,
    avgSpeedKmh: avgSpeed,
    avoidTolls,
    reorder,
  });

  // Persist the new sequence + schedule.
  for (const s of result.stops) {
    await db
      .from("route_stops")
      .update({
        stop_order: s.sequence,
        eta: s.eta.toISOString(),
        distance_from_prev_km: s.distanceFromPrevKm,
        predicted_delay_min: s.predictedDelayMin,
        planned_service_minutes: s.serviceMinutes,
      })
      .eq("id", s.id);
  }

  await db
    .from("routes")
    .update({
      total_distance_km: result.totalDistanceKm,
      total_duration_min: result.totalDurationMin,
      optimized_at: new Date().toISOString(),
    })
    .eq("id", routeId);
}

export interface DispatchResult {
  ok: boolean;
  routeId?: string;
  routeName?: string;
  reason?: string;
}

// Weaves an on-demand order into the best existing same-day route:
// capacity-feasible, then lowest added distance (zone match breaks ties).
export async function autoDispatch(db: DB, orderId: string): Promise<DispatchResult> {
  const { data: order } = await db
    .from("delivery_orders")
    .select(
      "id, scheduled_date, latitude, longitude, zone_id, delivery_items(quantity, weight)"
    )
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, reason: "Order not found" };
  if (!order.scheduled_date)
    return { ok: false, reason: "Order has no scheduled date" };

  const newWeight = orderWeight(order.delivery_items as ItemRow[] | null);
  const orderPoint: GeoPoint | null =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null;

  const settings = await getSettings(db);
  const depot: GeoPoint | null =
    settings.depot_lat != null && settings.depot_lng != null
      ? { lat: settings.depot_lat, lng: settings.depot_lng }
      : null;

  const { data: routes } = await db
    .from("routes")
    .select(
      "id, name, avoid_tolls, vehicle:vehicles(capacity_weight, max_stops, avoid_tolls), route_stops(id, delivery_order:delivery_orders(zone_id, latitude, longitude, delivery_items(quantity, weight)))"
    )
    .eq("route_date", order.scheduled_date)
    .in("status", ["planning", "assigned", "in_progress"]);

  let best: { id: string; name: string; cost: number; zoneMatch: boolean } | null = null;

  for (const r of routes ?? []) {
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const stops = (r.route_stops ?? []) as {
      delivery_order: unknown;
    }[];

    // Capacity check.
    let load = newWeight;
    let zoneMatch = false;
    let lastPoint: GeoPoint | null = depot;
    for (const st of stops) {
      const o = (Array.isArray(st.delivery_order) ? st.delivery_order[0] : st.delivery_order) as {
        zone_id: string | null;
        latitude: number | null;
        longitude: number | null;
        delivery_items: ItemRow[] | null;
      } | null;
      load += orderWeight(o?.delivery_items);
      if (o?.zone_id && order.zone_id && o.zone_id === order.zone_id) zoneMatch = true;
      if (o?.latitude != null && o?.longitude != null)
        lastPoint = { lat: o.latitude, lng: o.longitude };
    }

    const capacity = vehicle?.capacity_weight ?? null;
    if (capacity != null && load > capacity) continue; // won't fit
    if (vehicle?.max_stops != null && stops.length + 1 > vehicle.max_stops) continue;

    // Added-distance cost of tacking this order on near the route's end.
    let cost = 0;
    if (orderPoint && lastPoint) {
      cost = roadKm(lastPoint, orderPoint, r.avoid_tolls || vehicle?.avoid_tolls || false);
    } else {
      cost = stops.length; // no coords → prefer the emptier route
    }

    if (
      !best ||
      cost < best.cost - 0.01 ||
      (Math.abs(cost - best.cost) < 0.01 && zoneMatch && !best.zoneMatch)
    ) {
      best = { id: r.id, name: r.name, cost, zoneMatch };
    }
  }

  if (!best) {
    return {
      ok: false,
      reason: "No same-day route has capacity. Create or free up a route first.",
    };
  }

  const { data: maxRow } = await db
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", best.id)
    .order("stop_order", { ascending: false })
    .limit(1);
  const nextOrder = (maxRow?.[0]?.stop_order ?? 0) + 1;

  await db.from("route_stops").insert({
    route_id: best.id,
    delivery_order_id: orderId,
    stop_order: nextOrder,
    stop_type: "delivery",
  });
  await db
    .from("delivery_orders")
    .update({ status: "scheduled" })
    .eq("id", orderId)
    .eq("status", "pending");

  // Re-run optimisation so the new stop slots into the best position with ETAs.
  await reoptimizeRoute(db, best.id);

  return { ok: true, routeId: best.id, routeName: best.name };
}

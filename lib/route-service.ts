// Multi-stop route batching. Deliberately simple: a transparent
// nearest-neighbour + 2-opt heuristic (lib/routing.ts) re-sequences a day's
// stops for one provider's vehicle and produces ETAs. There is no claim of
// advanced optimization — this is a starting heuristic with a manual
// "re-optimize" trigger, not a solver.
import { withTransaction, query, queryOne } from "./db";
import { optimizeRoute, combineDateTime, type OptimizableStop, type GeoPoint } from "./routing";

export interface BatchResult {
  ok: boolean;
  routeId?: string;
  reason?: string;
}

// Groups every not-yet-batched, non-terminal assignment for a provider's
// vehicle on a given day into one route, then sequences it.
export async function autoBatchDay(providerOrgId: string, vehicleId: string, date: string): Promise<BatchResult> {
  const assignments = await query<{ id: string; booking_id: string }>(
    `select a.id, a.booking_id from assignments a
     join bookings b on b.id = a.booking_id
     where a.provider_org_id = $1 and a.vehicle_id = $2 and b.window_date = $3::date
       and a.status not in ('completed','failed','cancelled') and a.route_id is null`,
    [providerOrgId, vehicleId, date]
  );
  if (assignments.length === 0) return { ok: false, reason: "No unbatched jobs for that vehicle/date." };

  const routeId = await withTransaction(async (client) => {
    const route = await client.query<{ id: string }>(
      `insert into routes (provider_org_id, vehicle_id, route_date, status) values ($1,$2,$3::date,'planning') returning id`,
      [providerOrgId, vehicleId, date]
    );
    const rid = route.rows[0].id;

    for (const a of assignments) {
      const pickup = await client.query<{ id: string; latitude: number | null; longitude: number | null }>(
        `select id, latitude, longitude from booking_pickups where booking_id = $1 order by sequence limit 1`,
        [a.booking_id]
      );
      const dest = await client.query<{ latitude: number | null; longitude: number | null }>(
        `select latitude, longitude from booking_destination where booking_id = $1`,
        [a.booking_id]
      );
      await client.query(
        `insert into route_stops (route_id, booking_id, pickup_id, stop_type, sequence) values ($1,$2,$3,'pickup',0)`,
        [rid, a.booking_id, pickup.rows[0]?.id ?? null]
      );
      await client.query(`insert into route_stops (route_id, booking_id, stop_type, sequence) values ($1,$2,'delivery',0)`, [
        rid,
        a.booking_id,
      ]);
      await client.query(`update assignments set route_id = $2 where id = $1`, [a.id, rid]);
    }
    return rid;
  });

  await reoptimizeRoute(routeId);
  return { ok: true, routeId };
}

async function depotForProvider(providerOrgId: string): Promise<GeoPoint | null> {
  const isInternal = await queryOne<{ is_internal_fleet: boolean }>(`select is_internal_fleet from organizations where id = $1`, [providerOrgId]);
  if (!isInternal?.is_internal_fleet) return null;
  const wh = await queryOne<{ latitude: number | null; longitude: number | null }>(`select latitude, longitude from belliza_warehouses limit 1`);
  return wh?.latitude != null && wh?.longitude != null ? { lat: wh.latitude, lng: wh.longitude } : null;
}

export async function reoptimizeRoute(routeId: string): Promise<void> {
  const route = await queryOne<{ provider_org_id: string; route_date: string }>(`select provider_org_id, route_date from routes where id = $1`, [routeId]);
  if (!route) return;

  const stops = await query<{
    id: string;
    booking_id: string;
    stop_type: "pickup" | "delivery";
    latitude: number | null;
    longitude: number | null;
    window_end: string | null;
  }>(
    `select rs.id, rs.booking_id, rs.stop_type,
            coalesce(bp.latitude, bd.latitude) as latitude,
            coalesce(bp.longitude, bd.longitude) as longitude,
            b.window_end
     from route_stops rs
     join bookings b on b.id = rs.booking_id
     left join booking_pickups bp on bp.id = rs.pickup_id and rs.stop_type = 'pickup'
     left join booking_destination bd on bd.booking_id = rs.booking_id and rs.stop_type = 'delivery'
     where rs.route_id = $1`,
    [routeId]
  );
  if (stops.length === 0) return;

  const depot = await depotForProvider(route.provider_org_id);
  const startAt = combineDateTime(route.route_date, "08:00") ?? new Date();

  const optimizable: OptimizableStop[] = stops.map((s) => ({
    id: s.id,
    point: s.latitude != null && s.longitude != null ? { lat: s.latitude, lng: s.longitude } : null,
    serviceMinutes: s.stop_type === "pickup" ? 20 : 30,
    windowEnd: combineDateTime(route.route_date, s.window_end),
    weight: 0,
  }));

  const result = optimizeRoute(optimizable, { depot, startAt, avgSpeedKmh: 40, avoidTolls: false });

  await withTransaction(async (client) => {
    for (const s of result.stops) {
      await client.query(
        `update route_stops set sequence = $2, eta = $3, distance_from_prev_mi = $4, predicted_delay_min = $5 where id = $1`,
        [s.id, s.sequence, s.eta.toISOString(), Math.round(s.distanceFromPrevKm * 0.621371 * 10) / 10, s.predictedDelayMin]
      );
    }
    await client.query(
      `update routes set total_distance_mi = $2, total_duration_min = $3, optimized_at = now() where id = $1`,
      [routeId, Math.round(result.totalDistanceKm * 0.621371 * 10) / 10, result.totalDurationMin]
    );
  });
}

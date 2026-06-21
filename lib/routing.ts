// =====================================================================
//  Self-contained routing engine (no external API required).
//
//  - Haversine distance between geo-coordinates
//  - Nearest-neighbour construction + 2-opt improvement
//  - Schedule / ETA computation with predicted delay vs delivery windows
//  - Zone matching and vehicle capacity helpers
//
//  Distances are great-circle km; travel time = distance / avg speed,
//  inflated by ROAD_FACTOR to approximate real road distance. A toll-
//  avoidance flag adds a small detour penalty so routes differ when set.
// =====================================================================

export interface GeoPoint {
  lat: number;
  lng: number;
}

// Real roads are longer than straight lines — rough correction factor.
const ROAD_FACTOR = 1.3;
const TOLL_AVOID_FACTOR = 1.08;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

// Approximate driving distance in km between two points.
export function roadKm(a: GeoPoint, b: GeoPoint, avoidTolls = false): number {
  const base = haversineKm(a, b) * ROAD_FACTOR;
  return avoidTolls ? base * TOLL_AVOID_FACTOR : base;
}

export interface OptimizableStop {
  id: string;
  point: GeoPoint | null; // null when the order has no coordinates yet
  serviceMinutes: number;
  windowEnd: Date | null; // latest acceptable arrival
  weight: number; // load contribution (for capacity)
}

export interface OptimizeOptions {
  depot: GeoPoint | null;
  startAt: Date;
  avgSpeedKmh: number;
  avoidTolls: boolean;
  // When false, keep the given order and only (re)compute the schedule/ETAs.
  reorder?: boolean;
}

export interface ScheduledStop {
  id: string;
  sequence: number;
  distanceFromPrevKm: number;
  eta: Date;
  serviceMinutes: number;
  predictedDelayMin: number;
}

export interface OptimizeResult {
  stops: ScheduledStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

// Orders stops with nearest-neighbour from the depot, improves with 2-opt,
// then computes the timed schedule. Stops without coordinates are appended
// in their original order (they can't be geo-optimised).
export function optimizeRoute(
  stops: OptimizableStop[],
  opts: OptimizeOptions
): OptimizeResult {
  if (opts.reorder === false) {
    // Keep the caller's order; just rebuild the timed schedule.
    return schedule(stops, opts);
  }

  const located = stops.filter((s) => s.point !== null);
  const unlocated = stops.filter((s) => s.point === null);

  let ordered = located;
  if (opts.depot && located.length > 1) {
    const nn = nearestNeighbour(opts.depot, located, opts.avoidTolls);
    ordered = twoOpt(opts.depot, nn, opts.avoidTolls);
  }

  const sequenced = [...ordered, ...unlocated];
  return schedule(sequenced, opts);
}

function nearestNeighbour(
  depot: GeoPoint,
  stops: OptimizableStop[],
  avoidTolls: boolean
): OptimizableStop[] {
  const remaining = [...stops];
  const result: OptimizableStop[] = [];
  let current: GeoPoint = depot;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = roadKm(current, remaining[i].point!, avoidTolls);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    result.push(next);
    current = next.point!;
  }
  return result;
}

// Classic 2-opt: repeatedly reverse segments that shorten the tour.
function twoOpt(
  depot: GeoPoint,
  stops: OptimizableStop[],
  avoidTolls: boolean
): OptimizableStop[] {
  const route = [...stops];
  const dist = (a: GeoPoint, b: GeoPoint) => roadKm(a, b, avoidTolls);

  const legLength = (arr: OptimizableStop[]) => {
    let total = 0;
    let prev = depot;
    for (const s of arr) {
      total += dist(prev, s.point!);
      prev = s.point!;
    }
    return total;
  };

  let improved = true;
  let best = legLength(route);
  // Cap iterations so large routes stay responsive.
  let guard = 0;
  while (improved && guard < 50) {
    improved = false;
    guard++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let k = i + 1; k < route.length; k++) {
        const candidate = route
          .slice(0, i)
          .concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
        const len = legLength(candidate);
        if (len + 1e-9 < best) {
          route.splice(0, route.length, ...candidate);
          best = len;
          improved = true;
        }
      }
    }
  }
  return route;
}

// Walks the ordered stops from the depot at startAt, accumulating travel +
// service time to produce an ETA and a predicted delay for each stop.
function schedule(
  ordered: OptimizableStop[],
  opts: OptimizeOptions
): OptimizeResult {
  const speed = opts.avgSpeedKmh > 0 ? opts.avgSpeedKmh : 40;
  let clock = new Date(opts.startAt);
  let prev: GeoPoint | null = opts.depot;
  let totalDistance = 0;

  const scheduled: ScheduledStop[] = ordered.map((s, idx) => {
    let legKm = 0;
    if (prev && s.point) {
      legKm = roadKm(prev, s.point, opts.avoidTolls);
      const travelMin = (legKm / speed) * 60;
      clock = new Date(clock.getTime() + travelMin * 60_000);
    }
    totalDistance += legKm;

    const eta = new Date(clock);
    // Add the on-site service time before departing for the next stop.
    clock = new Date(clock.getTime() + s.serviceMinutes * 60_000);
    if (s.point) prev = s.point;

    const predictedDelayMin = s.windowEnd
      ? Math.max(0, Math.round((eta.getTime() - s.windowEnd.getTime()) / 60_000))
      : 0;

    return {
      id: s.id,
      sequence: idx + 1,
      distanceFromPrevKm: round1(legKm),
      eta,
      serviceMinutes: s.serviceMinutes,
      predictedDelayMin,
    };
  });

  const totalDurationMin = Math.round(
    (clock.getTime() - opts.startAt.getTime()) / 60_000
  );

  return {
    stops: scheduled,
    totalDistanceKm: round1(totalDistance),
    totalDurationMin,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// --- Zones -----------------------------------------------------------
export interface ZoneLike {
  id: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  postal_prefixes: string[];
}

// Returns the first zone that contains the given point/postal code.
export function matchZone(
  zones: ZoneLike[],
  point: GeoPoint | null,
  postalCode: string | null
): string | null {
  for (const z of zones) {
    if (
      postalCode &&
      z.postal_prefixes.some((p) => postalCode.startsWith(p.trim()))
    ) {
      return z.id;
    }
    if (
      point &&
      z.center_lat != null &&
      z.center_lng != null &&
      z.radius_km != null
    ) {
      const d = haversineKm(point, { lat: z.center_lat, lng: z.center_lng });
      if (d <= z.radius_km) return z.id;
    }
  }
  return null;
}

// Combine a date (YYYY-MM-DD) and a time (HH:MM[:SS]) into a Date.
export function combineDateTime(date: string, time: string | null): Date | null {
  if (!date) return null;
  const t = time && time.length >= 4 ? time : "00:00:00";
  return new Date(`${date}T${t.length === 5 ? t + ":00" : t}`);
}

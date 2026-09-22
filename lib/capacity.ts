// Transactional capacity holds. A hold atomically reserves one conservative
// "job slot" on a specific vehicle for a specific day. Two concurrent
// requests can never both win the last slot because the reservation is a
// single `UPDATE ... WHERE held_jobs < max_jobs RETURNING *`, which Postgres
// row-locks for the duration of the transaction.
import type { PoolClient } from "pg";
import { withTransaction } from "./db";

export const CHECKOUT_HOLD_MINUTES = 15;

export interface HoldResult {
  ok: boolean;
  holdId?: string;
  reason?: string;
}

// Must be called at the start of any capacity-affecting transaction so
// reads never treat a lapsed checkout hold as still consuming a slot.
export async function expireStaleHolds(client: PoolClient): Promise<void> {
  await client.query("select public.expire_stale_holds()");
}

async function ensureDayCapacityRow(
  client: PoolClient,
  vehicleId: string,
  day: string
): Promise<void> {
  await client.query(
    `insert into vehicle_day_capacity (vehicle_id, day, max_jobs, held_jobs)
     select $1, $2::date, v.max_jobs_per_day, 0
     from provider_vehicles v where v.id = $1
     on conflict (vehicle_id, day) do nothing`,
    [vehicleId, day]
  );
}

// Reserves one slot on `vehicleId` for `day` (YYYY-MM-DD), expiring in
// CHECKOUT_HOLD_MINUTES unless committed. Returns ok:false if the vehicle
// has no remaining capacity that day.
export async function createCapacityHold(opts: {
  bookingId: string;
  providerOrgId: string;
  vehicleId: string;
  day: string;
  committed?: boolean; // true for direct/offer-accept assignment, false for a checkout hold
}): Promise<HoldResult> {
  try {
    return await runCreateCapacityHold(opts);
  } catch (err) {
    // Two concurrent callers can both pass the pre-check above before
    // either commits; the unique partial index on capacity_holds(booking_id)
    // is the real guard, and its violation surfaces here as a thrown
    // Postgres error (code 23505) rather than a normal return value.
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, reason: "This booking already has a live capacity hold." };
    }
    throw err;
  }
}

async function runCreateCapacityHold(opts: {
  bookingId: string;
  providerOrgId: string;
  vehicleId: string;
  day: string;
  committed?: boolean;
}): Promise<HoldResult> {
  return withTransaction(async (client) => {
    await expireStaleHolds(client);
    await ensureDayCapacityRow(client, opts.vehicleId, opts.day);

    // Only one live hold per booking at a time (unique partial index also
    // enforces this, but checking first gives a clean error message).
    const existing = await client.query(
      `select id from capacity_holds where booking_id = $1 and status in ('active','committed')`,
      [opts.bookingId]
    );
    if (existing.rows.length > 0) {
      return { ok: false, reason: "This booking already has a live capacity hold." };
    }

    const updated = await client.query(
      `update vehicle_day_capacity
         set held_jobs = held_jobs + 1
       where vehicle_id = $1 and day = $2::date and held_jobs < max_jobs
       returning vehicle_id`,
      [opts.vehicleId, opts.day]
    );
    if (updated.rows.length === 0) {
      return { ok: false, reason: "No remaining capacity on this vehicle for the selected date." };
    }

    const status = opts.committed ? "committed" : "active";
    const expiresAt = opts.committed
      ? "9999-12-31" // committed holds don't expire; only 'active' checkout holds do
      : new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000).toISOString();

    const inserted = await client.query<{ id: string }>(
      `insert into capacity_holds (booking_id, provider_org_id, vehicle_id, window_date, status, expires_at)
       values ($1, $2, $3, $4::date, $5, $6)
       returning id`,
      [opts.bookingId, opts.providerOrgId, opts.vehicleId, opts.day, status, expiresAt]
    );

    return { ok: true, holdId: inserted.rows[0].id };
  });
}

export async function commitCapacityHold(holdId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `update capacity_holds set status = 'committed' where id = $1 and status = 'active'`,
      [holdId]
    );
  });
}

// Returns the slot to the vehicle's day budget and marks the hold released.
export async function releaseCapacityHold(holdId: string): Promise<void> {
  await withTransaction(async (client) => {
    const rows = await client.query<{ vehicle_id: string; window_date: string; status: string }>(
      `select vehicle_id, window_date, status from capacity_holds where id = $1 for update`,
      [holdId]
    );
    const hold = rows.rows[0];
    if (!hold || hold.status === "released" || hold.status === "expired") return;
    await client.query(
      `update vehicle_day_capacity set held_jobs = greatest(0, held_jobs - 1)
       where vehicle_id = $1 and day = $2::date`,
      [hold.vehicle_id, hold.window_date]
    );
    await client.query(`update capacity_holds set status = 'released' where id = $1`, [holdId]);
  });
}

export interface VehicleAvailability {
  vehicleId: string;
  name: string;
  remainingSlots: number;
  maxJobs: number;
}

// Conservative day-level availability across a provider org's active
// vehicles. Used to decide which windows to show as bookable and to pick a
// vehicle for internal-fleet auto-assignment.
export async function listVehicleAvailability(
  client: PoolClient,
  providerOrgId: string,
  day: string
): Promise<VehicleAvailability[]> {
  await expireStaleHolds(client);
  const { rows } = await client.query<{
    id: string;
    name: string;
    max_jobs_per_day: number;
    held_jobs: number | null;
  }>(
    `select v.id, v.name, v.max_jobs_per_day,
            (select held_jobs from vehicle_day_capacity c where c.vehicle_id = v.id and c.day = $2::date) as held_jobs
       from provider_vehicles v
      where v.org_id = $1 and v.status = 'active'
      order by v.name`,
    [providerOrgId, day]
  );
  return rows.map((r) => ({
    vehicleId: r.id,
    name: r.name,
    maxJobs: r.max_jobs_per_day,
    remainingSlots: r.max_jobs_per_day - (r.held_jobs ?? 0),
  }));
}

// ---- Oversize / heavy-item review (pure logic, no DB) ----------------------

export interface FitCheckItem {
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  dimsUnknown: boolean;
  weightLbs: number | null;
}

export interface FitCheckVehicle {
  doorWidthIn: number | null;
  cargoLengthIn: number | null;
  payloadLbs: number;
}

export interface FitCheckResult {
  fits: "likely" | "needs_review" | "unlikely";
  reasons: string[];
}

// Deliberately conservative: we only check the smallest opening (door
// width) against each item's smallest dimension, and total weight against
// payload. We never claim that cubic volume alone guarantees an item
// physically fits through a doorway or stairwell.
export function assessVehicleFit(items: FitCheckItem[], vehicle: FitCheckVehicle): FitCheckResult {
  const reasons: string[] = [];
  let fits: FitCheckResult["fits"] = "likely";

  let totalWeight = 0;
  for (const item of items) {
    if (item.dimsUnknown) {
      reasons.push("One or more items have unknown dimensions.");
      fits = "needs_review";
      continue;
    }
    totalWeight += item.weightLbs ?? 0;
    if (vehicle.doorWidthIn != null && item.lengthIn != null && item.widthIn != null) {
      const smallestItemDim = Math.min(item.lengthIn, item.widthIn, item.heightIn ?? item.lengthIn);
      if (smallestItemDim > vehicle.doorWidthIn) {
        reasons.push(`An item's smallest dimension (${smallestItemDim}") exceeds the vehicle's door opening (${vehicle.doorWidthIn}").`);
        fits = "unlikely";
      }
    }
  }

  if (totalWeight > vehicle.payloadLbs) {
    reasons.push(`Total item weight (${totalWeight} lbs) exceeds vehicle payload (${vehicle.payloadLbs} lbs).`);
    fits = "unlikely";
  }

  return { fits, reasons };
}

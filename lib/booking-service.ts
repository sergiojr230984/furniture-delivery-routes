// Core booking domain logic shared by the retailer wizard, the seed script
// and (indirectly, via the state machine + capacity module) dispatch.
// Every mutating function re-validates state server-side; nothing here
// trusts a client-supplied status or price.
import { query, queryOne, withTransaction } from "./db";
import { computeQuote, EXAMPLE_PRICING_CONFIG, type QuoteItemInput } from "./pricing";
import { assertTransition } from "./state-machine";
import { createCapacityHold, listVehicleAvailability } from "./capacity";
import { createTrackingToken, createAccessToken, trackingUrl } from "./tracking";
import { authorizeBookingPayment } from "./payments";
import { recordBookingLedgerEntries } from "./ledger";
import { notifyBookingConfirmed } from "./notify";
import { haversineKm } from "./routing";
import type {
  BookingStatus,
  ItemCategory,
  PackagingCondition,
  PickupType,
  ServiceLevel,
} from "./constants";
import type { PricingConfig, QuoteBreakdown } from "./types";

const MILES_PER_KM = 0.621371;
const ROAD_FACTOR = 1.3;
const DEFAULT_FALLBACK_MILES = 12;
const OFFER_WINDOW_HOURS = 3;

export interface DraftBookingInput {
  retailerOrgId: string;
  createdBy: string;
  retailerLocationId?: string | null;
  isDemo?: boolean;
}

// Every retailer-facing page/action must call this before reading or
// writing a booking so one retailer can never reach another's data.
export async function assertBookingOwnedByOrg(bookingId: string, retailerOrgId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(`select id from bookings where id = $1 and retailer_org_id = $2`, [
    bookingId,
    retailerOrgId,
  ]);
  if (!row) throw new Error("Booking not found");
}

export async function createDraftBooking(input: DraftBookingInput): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `insert into bookings (retailer_org_id, retailer_location_id, created_by, is_demo)
     values ($1,$2,$3,$4) returning id`,
    [input.retailerOrgId, input.retailerLocationId ?? null, input.createdBy, input.isDemo ?? false]
  );
  await query(`insert into booking_destination (booking_id) values ($1)`, [row!.id]);
  return row!.id;
}

export interface PickupInput {
  pickupType: PickupType;
  locationId?: string | null;
  warehouseId?: string | null;
  warehouseOrderNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  floor?: number | null;
  stairsFlights?: number;
  elevatorAvailable?: boolean;
  parkingNotes?: string | null;
  instructions?: string | null;
}

export async function replacePickups(bookingId: string, pickups: PickupInput[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`delete from booking_pickups where booking_id = $1`, [bookingId]);
    let seq = 1;
    for (const p of pickups) {
      await client.query(
        `insert into booking_pickups
           (booking_id, sequence, pickup_type, location_id, warehouse_id, warehouse_order_number,
            address_line1, address_line2, city, postal_code, latitude, longitude,
            contact_name, contact_phone, floor, stairs_flights, elevator_available, parking_notes, instructions)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          bookingId,
          seq++,
          p.pickupType,
          p.locationId ?? null,
          p.warehouseId ?? null,
          p.warehouseOrderNumber ?? null,
          p.addressLine1 ?? null,
          p.addressLine2 ?? null,
          p.city ?? null,
          p.postalCode ?? null,
          p.latitude ?? null,
          p.longitude ?? null,
          p.contactName ?? null,
          p.contactPhone ?? null,
          p.floor ?? null,
          p.stairsFlights ?? 0,
          p.elevatorAvailable ?? false,
          p.parkingNotes ?? null,
          p.instructions ?? null,
        ]
      );
    }
  });
}

export interface ItemInput {
  savedProductId?: string | null;
  name: string;
  category: ItemCategory;
  quantity: number;
  lengthIn?: number | null;
  widthIn?: number | null;
  heightIn?: number | null;
  weightLbs?: number | null;
  dimsUnknown?: boolean;
  photos?: string[];
  declaredValue?: number | null;
  packagingCondition?: PackagingCondition;
  assemblyRequired?: boolean;
}

const HEAVY_ITEM_LBS = 300;

export async function replaceItems(bookingId: string, items: ItemInput[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`delete from booking_items where booking_id = $1`, [bookingId]);
    for (const it of items) {
      const reasons: string[] = [];
      if (it.dimsUnknown) reasons.push("Dimensions unknown");
      if (it.weightLbs != null && it.weightLbs > HEAVY_ITEM_LBS) reasons.push(`Heavy item (${it.weightLbs} lbs)`);
      await client.query(
        `insert into booking_items
           (booking_id, saved_product_id, name, category, quantity, length_in, width_in, height_in, weight_lbs,
            dims_unknown, photos, declared_value, packaging_condition, assembly_required, needs_review, review_reason)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          bookingId,
          it.savedProductId ?? null,
          it.name,
          it.category,
          it.quantity,
          it.lengthIn ?? null,
          it.widthIn ?? null,
          it.heightIn ?? null,
          it.weightLbs ?? null,
          it.dimsUnknown ?? false,
          JSON.stringify(it.photos ?? []),
          it.declaredValue ?? null,
          it.packagingCondition ?? "unknown",
          it.assemblyRequired ?? false,
          reasons.length > 0,
          reasons.join("; ") || null,
        ]
      );
    }
  });
}

export interface DestinationInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  floor?: number | null;
  stairsFlights?: number;
  elevatorAvailable?: boolean;
  elevatorReserved?: boolean;
  buildingHours?: string | null;
  parkingNotes?: string | null;
  walkingDistanceFt?: number | null;
  instructions?: string | null;
}

export async function upsertDestination(bookingId: string, d: DestinationInput): Promise<void> {
  await query(
    `update booking_destination set
       customer_name=$2, customer_phone=$3, customer_email=$4, address_line1=$5, address_line2=$6,
       city=$7, postal_code=$8, latitude=$9, longitude=$10, floor=$11, stairs_flights=$12,
       elevator_available=$13, elevator_reserved=$14, building_hours=$15, parking_notes=$16,
       walking_distance_ft=$17, instructions=$18
     where booking_id = $1`,
    [
      bookingId,
      d.customerName,
      d.customerPhone,
      d.customerEmail ?? null,
      d.addressLine1,
      d.addressLine2 ?? null,
      d.city,
      d.postalCode,
      d.latitude ?? null,
      d.longitude ?? null,
      d.floor ?? null,
      d.stairsFlights ?? 0,
      d.elevatorAvailable ?? false,
      d.elevatorReserved ?? false,
      d.buildingHours ?? null,
      d.parkingNotes ?? null,
      d.walkingDistanceFt ?? null,
      d.instructions ?? null,
    ]
  );
}

export interface ServiceOptionsInput {
  serviceLevel: ServiceLevel;
  priority: boolean;
  debrisRemoval: boolean;
  oldFurnitureRemoval: boolean;
}

export async function updateServiceOptions(bookingId: string, opts: ServiceOptionsInput): Promise<void> {
  await query(
    `update bookings set service_level=$2, priority=$3, debris_removal=$4, old_furniture_removal=$5 where id=$1`,
    [bookingId, opts.serviceLevel, opts.priority, opts.debrisRemoval, opts.oldFurnitureRemoval]
  );
}

async function getActivePricingRuleSet(): Promise<{ id: string; version: number; config: PricingConfig }> {
  const row = await queryOne<{ id: string; version: number; config: PricingConfig }>(
    `select id, version, config from pricing_rule_sets where status = 'active' order by version desc limit 1`
  );
  if (row) return row;
  // Fail-safe so the app never hard-crashes if no rule set has been
  // activated yet — this should not happen once the seed has run.
  return { id: "", version: 0, config: EXAMPLE_PRICING_CONFIG };
}

function distanceMilesBetween(
  a: { latitude: number | null; longitude: number | null } | null,
  b: { latitude: number | null; longitude: number | null } | null
): { miles: number; estimated: boolean } {
  if (a?.latitude != null && a?.longitude != null && b?.latitude != null && b?.longitude != null) {
    const km = haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
    return { miles: km * MILES_PER_KM * ROAD_FACTOR, estimated: false };
  }
  return { miles: DEFAULT_FALLBACK_MILES, estimated: true };
}

export async function generateQuote(bookingId: string): Promise<QuoteBreakdown> {
  const booking = await queryOne<{ id: string; status: BookingStatus; retailer_org_id: string; service_level: ServiceLevel; priority: boolean; debris_removal: boolean; old_furniture_removal: boolean }>(
    `select id, status, retailer_org_id, service_level, priority, debris_removal, old_furniture_removal from bookings where id = $1`,
    [bookingId]
  );
  if (!booking) throw new Error("Booking not found");

  const pickups = await query<{ latitude: number | null; longitude: number | null; stairs_flights: number }>(
    `select latitude, longitude, stairs_flights from booking_pickups where booking_id = $1 order by sequence`,
    [bookingId]
  );
  const destination = await queryOne<{ latitude: number | null; longitude: number | null; stairs_flights: number }>(
    `select latitude, longitude, stairs_flights from booking_destination where booking_id = $1`,
    [bookingId]
  );
  const items = await query<{
    category: ItemCategory;
    quantity: number;
    weight_lbs: string | null;
    dims_unknown: boolean;
    assembly_required: boolean;
  }>(`select category, quantity, weight_lbs, dims_unknown, assembly_required from booking_items where booking_id = $1`, [bookingId]);

  if (items.length === 0) throw new Error("Add at least one item before requesting a quote.");
  if (pickups.length === 0) throw new Error("Add a pickup before requesting a quote.");

  const ruleSet = await getActivePricingRuleSet();
  const firstPickup = pickups[0];
  const { miles, estimated } = distanceMilesBetween(firstPickup, destination);

  const quoteItems: QuoteItemInput[] = items.map((i) => ({
    category: i.category,
    quantity: i.quantity,
    weightLbs: i.weight_lbs != null ? parseFloat(i.weight_lbs) : null,
    dimsUnknown: i.dims_unknown,
    assemblyRequired: i.assembly_required,
  }));

  const stairsFlightsTotal = pickups.reduce((s, p) => s + (p.stairs_flights ?? 0), 0) + (destination?.stairs_flights ?? 0);

  const breakdown = computeQuote(
    {
      items: quoteItems,
      distanceMiles: miles,
      serviceLevel: booking.service_level,
      stairsFlightsTotal,
      priority: booking.priority,
      debrisRemoval: booking.debris_removal,
      oldFurnitureRemoval: booking.old_furniture_removal,
      extraStopsCount: Math.max(0, pickups.length - 1),
      retailerOrgId: booking.retailer_org_id,
    },
    ruleSet.config,
    ruleSet.version
  );

  if (estimated) {
    // Informational only — a missing geocode is expected without a
    // configured geocoding provider and is not, by itself, a capacity or
    // fit risk, so it does not block instant confirmation.
    breakdown.lineItems.push({ label: "Distance estimated (address not geocoded)", amount: 0 });
  }

  const nextStatus: BookingStatus = booking.status === "draft" ? "quote_ready" : booking.status;
  if (booking.status === "draft") assertTransition("draft", "quote_ready");

  await query(
    `update bookings set quote=$2::jsonb, price_total=$3, pricing_rule_set_id=$4, status=$5 where id=$1`,
    [bookingId, JSON.stringify(breakdown), breakdown.total, ruleSet.id || null, nextStatus]
  );
  if (booking.status === "draft") {
    await query(`insert into status_events (booking_id, from_status, to_status, notes) values ($1,'draft','quote_ready','Quote generated')`, [bookingId]);
  }

  return breakdown;
}

export interface AvailabilityDay {
  date: string;
  remainingSlots: number;
}

// Conservative internal-fleet availability for the next `days` days —
// shown to the retailer as bookable windows. A day is only offered if at
// least one active internal vehicle has a remaining slot.
export async function getInternalAvailability(bellizaCrewOrgId: string, days = 10): Promise<AvailabilityDay[]> {
  return withTransaction(async (client) => {
    const results: AvailabilityDay[] = [];
    const today = new Date();
    for (let i = 1; i <= days; i++) {
      const d = new Date(today.getTime() + i * 86_400_000);
      const dateStr = d.toISOString().slice(0, 10);
      const availability = await listVehicleAvailability(client, bellizaCrewOrgId, dateStr);
      const remaining = availability.reduce((max, v) => Math.max(max, v.remainingSlots), 0);
      results.push({ date: dateStr, remainingSlots: remaining });
    }
    return results;
  });
}

export interface ConfirmResult {
  ok: boolean;
  reason?: string;
  bookingId: string;
  status?: BookingStatus;
}

// Instant internal confirmation: reserves real committed capacity on a
// Belliza-fleet vehicle before the booking is ever labeled "confirmed".
export async function confirmInternalBooking(opts: {
  bookingId: string;
  bellizaCrewOrgId: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
  actingUserId: string;
}): Promise<ConfirmResult> {
  const booking = await queryOne<{ status: BookingStatus; retailer_org_id: string; price_total: string; quote: QuoteBreakdown; is_demo: boolean }>(
    `select status, retailer_org_id, price_total, quote, is_demo from bookings where id = $1`,
    [opts.bookingId]
  );
  if (!booking) return { ok: false, reason: "Booking not found", bookingId: opts.bookingId };
  assertTransition(booking.status, "confirmed");

  const day = opts.windowDate;
  const availability = await withTransaction((client) => listVehicleAvailability(client, opts.bellizaCrewOrgId, day));
  const vehicle = availability.find((v) => v.remainingSlots > 0);
  if (!vehicle) {
    return { ok: false, reason: "No internal capacity remaining for that date.", bookingId: opts.bookingId };
  }

  const hold = await createCapacityHold({
    bookingId: opts.bookingId,
    providerOrgId: opts.bellizaCrewOrgId,
    vehicleId: vehicle.vehicleId,
    day,
    committed: true,
  });
  if (!hold.ok) {
    return { ok: false, reason: hold.reason, bookingId: opts.bookingId };
  }

  const crew = await query<{ id: string }>(
    `select id from crew_members where org_id = $1 and active = true order by created_at limit 2`,
    [opts.bellizaCrewOrgId]
  );

  await withTransaction(async (client) => {
    await client.query(
      `update bookings set status='confirmed', mode='internal', window_date=$2, window_start=$3, window_end=$4 where id=$1`,
      [opts.bookingId, day, opts.windowStart, opts.windowEnd]
    );
    const assignment = await client.query<{ id: string }>(
      `insert into assignments (booking_id, provider_org_id, vehicle_id, status, assigned_by)
       values ($1,$2,$3,'assigned',$4) returning id`,
      [opts.bookingId, opts.bellizaCrewOrgId, vehicle.vehicleId, opts.actingUserId]
    );
    for (const c of crew) {
      await client.query(`insert into assignment_crew (assignment_id, crew_member_id) values ($1,$2)`, [
        assignment.rows[0].id,
        c.id,
      ]);
    }
    await client.query(
      `insert into status_events (booking_id, from_status, to_status, actor_user_id, notes) values ($1,$2,'confirmed',$3,'Internal capacity confirmed')`,
      [opts.bookingId, booking.status, opts.actingUserId]
    );
  });

  const price = parseFloat(booking.price_total);
  const payment = await authorizeBookingPayment({
    bookingId: opts.bookingId,
    amount: price,
    currency: "USD",
    isDemoOrg: booking.is_demo,
  });
  await query(`update payments set status = $2 where id = $1`, [payment.paymentId, payment.demo ? "demo_recorded" : "authorized"]);

  await recordBookingLedgerEntries({
    bookingId: opts.bookingId,
    retailerOrgId: booking.retailer_org_id,
    providerOrgId: opts.bellizaCrewOrgId,
    isInternalFleet: true,
    price,
    providerPayout: booking.quote.providerPayout,
    processingFee: booking.quote.processingFeeEstimate,
    isDemo: booking.is_demo,
  });

  const token = await createTrackingToken(opts.bookingId);
  await createAccessToken(opts.bookingId);

  const dest = await queryOne<{ customer_phone: string | null; customer_email: string | null }>(
    `select customer_phone, customer_email from booking_destination where booking_id = $1`,
    [opts.bookingId]
  );
  const bookingNumber = await queryOne<{ booking_number: string }>(`select booking_number from bookings where id = $1`, [opts.bookingId]);

  await notifyBookingConfirmed({
    id: opts.bookingId,
    retailerOrgId: booking.retailer_org_id,
    bookingNumber: bookingNumber!.booking_number,
    customerPhone: dest?.customer_phone ?? null,
    customerEmail: dest?.customer_email ?? null,
    windowDate: day,
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
    trackingUrl: trackingUrl(token),
  });

  return { ok: true, bookingId: opts.bookingId, status: "confirmed" };
}

// Marketplace path: no capacity is secured yet, so the booking is only
// ever labeled "awaiting provider acceptance" until an offer is accepted
// (see lib/offers.ts for the atomic accept flow).
export async function requestMarketplaceFulfillment(opts: {
  bookingId: string;
  windowDate: string;
  windowStart: string;
  windowEnd: string;
  actingUserId: string;
}): Promise<ConfirmResult> {
  const booking = await queryOne<{ status: BookingStatus; quote: QuoteBreakdown }>(
    `select status, quote from bookings where id = $1`,
    [opts.bookingId]
  );
  if (!booking) return { ok: false, reason: "Booking not found", bookingId: opts.bookingId };
  assertTransition(booking.status, "awaiting_acceptance");

  await withTransaction(async (client) => {
    await client.query(
      `update bookings set status='awaiting_acceptance', mode='marketplace', window_date=$2, window_start=$3, window_end=$4 where id=$1`,
      [opts.bookingId, opts.windowDate, opts.windowStart, opts.windowEnd]
    );
    await client.query(
      `insert into status_events (booking_id, from_status, to_status, actor_user_id, notes)
       values ($1,$2,'awaiting_acceptance',$3,'Sent to delivery provider network')`,
      [opts.bookingId, booking.status, opts.actingUserId]
    );

    const providers = await client.query<{ id: string }>(
      `select id from organizations where type = 'provider' and is_internal_fleet = false and status = 'active'`
    );
    const expiresAt = new Date(Date.now() + OFFER_WINDOW_HOURS * 3_600_000).toISOString();
    for (const p of providers.rows) {
      await client.query(
        `insert into offers (booking_id, provider_org_id, payout_amount, scope, expires_at, created_by)
         values ($1,$2,$3,$4::jsonb,$5,$6)`,
        [
          opts.bookingId,
          p.id,
          booking.quote.providerPayout,
          JSON.stringify({ note: "Approximate route and item details are shown on the offer detail screen." }),
          expiresAt,
          opts.actingUserId,
        ]
      );
    }
  });

  await createTrackingToken(opts.bookingId);
  await createAccessToken(opts.bookingId);

  return { ok: true, bookingId: opts.bookingId, status: "awaiting_acceptance" };
}

// Integration tests against a real Postgres database (belliza_test).
// These exercise the exact race conditions the spec calls out: concurrent
// capacity reservation, double offer acceptance, webhook idempotency, and
// expired tracking links. Run `npm run db:test:setup` once before `npm test`.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { pool, query, queryOne } from "../../lib/db";
import { createCapacityHold } from "../../lib/capacity";
import { recordWebhookEventOnce } from "../../lib/payments";
import { createTrackingToken, resolveTrackingToken } from "../../lib/tracking";
import {
  createDraftBooking,
  replacePickups,
  replaceItems,
  upsertDestination,
  updateServiceOptions,
  generateQuote,
  requestMarketplaceFulfillment,
} from "../../lib/booking-service";
import { acceptOffer } from "../../lib/offers";

let casaMiamiId: string;
let salespersonId: string;
let locationId: string;
let productId: string;
let sunshineId: string;
let sunshineVehicleId: string;
let sunshineCrewIds: string[];
let sunshineOwnerId: string;
let triCountyId: string;
let triVehicleId: string;
let triCrewIds: string[];
let triOwnerId: string;

// A fresh, effectively-unique future date per call so the suite is safe to
// re-run repeatedly against the same test database without reseeding.
function randomFutureDate(): string {
  const days = 400 + Math.floor(Math.random() * 9000);
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

beforeAll(async () => {
  const casaMiami = await queryOne<{ id: string }>(`select id from organizations where name = 'Casa Miami Furniture'`);
  casaMiamiId = casaMiami!.id;
  salespersonId = (await queryOne<{ id: string }>(`select id from users where email = 'sales@casamiami.demo'`))!.id;
  locationId = (await queryOne<{ id: string }>(`select id from retailer_locations where org_id = $1 limit 1`, [casaMiamiId]))!.id;
  productId = (await queryOne<{ id: string }>(`select id from saved_products where org_id = $1 limit 1`, [casaMiamiId]))!.id;

  sunshineId = (await queryOne<{ id: string }>(`select id from organizations where name = 'Sunshine Movers Miami'`))!.id;
  sunshineVehicleId = (await queryOne<{ id: string }>(`select id from provider_vehicles where org_id = $1 limit 1`, [sunshineId]))!.id;
  sunshineCrewIds = (await query<{ id: string }>(`select id from crew_members where org_id = $1 limit 2`, [sunshineId])).map((r) => r.id);
  sunshineOwnerId = (await queryOne<{ id: string }>(`select id from users where email = 'owner@sunshinemovers.demo'`))!.id;

  triCountyId = (await queryOne<{ id: string }>(`select id from organizations where name = 'Tri-County Delivery Partners'`))!.id;
  await query(`update organizations set status = 'active' where id = $1`, [triCountyId]);
  triVehicleId = (await queryOne<{ id: string }>(`select id from provider_vehicles where org_id = $1 limit 1`, [triCountyId]))!.id;
  triCrewIds = (await query<{ id: string }>(`select id from crew_members where org_id = $1 limit 2`, [triCountyId])).map((r) => r.id);
  triOwnerId = (await queryOne<{ id: string }>(`select id from users where email = 'owner@tricounty.demo'`))!.id;
});

afterAll(async () => {
  await pool.end();
});

async function createMarketplaceBooking(windowDate: string) {
  const bookingId = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
  await replacePickups(bookingId, [{ pickupType: "store", locationId, addressLine1: "x", city: "Miami", postalCode: "33101" }]);
  await replaceItems(bookingId, [{ savedProductId: productId, name: "Test item", category: "sofa", quantity: 1 }]);
  await upsertDestination(bookingId, { customerName: "Test", customerPhone: "+13055550000", addressLine1: "y", city: "Miami", postalCode: "33101" });
  await updateServiceOptions(bookingId, { serviceLevel: "curbside", priority: false, debrisRemoval: false, oldFurnitureRemoval: false });
  await generateQuote(bookingId);
  await requestMarketplaceFulfillment({ bookingId, windowDate, windowStart: "09:00", windowEnd: "12:00", actingUserId: salespersonId });
  return bookingId;
}

describe("concurrent capacity reservation", () => {
  it("lets exactly one of two simultaneous holds win the last slot", async () => {
    const vehicle = await queryOne<{ id: string }>(
      `insert into provider_vehicles (org_id, name, max_jobs_per_day, payload_lbs) values ($1,$2,1,1000) returning id`,
      [sunshineId, `Race Test Van ${randomUUID().slice(0, 8)}`]
    );
    const day = randomFutureDate();
    const bookingA = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    const bookingB = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });

    const [r1, r2] = await Promise.all([
      createCapacityHold({ bookingId: bookingA, providerOrgId: sunshineId, vehicleId: vehicle!.id, day, committed: true }),
      createCapacityHold({ bookingId: bookingB, providerOrgId: sunshineId, vehicleId: vehicle!.id, day, committed: true }),
    ]);

    const wins = [r1, r2].filter((r) => r.ok).length;
    expect(wins).toBe(1);
    const loser = r1.ok ? r2 : r1;
    expect(loser.reason).toMatch(/no remaining capacity/i);
  });

  it("rejects a hold once the vehicle's day is fully booked, even sequentially", async () => {
    const vehicle = await queryOne<{ id: string }>(
      `insert into provider_vehicles (org_id, name, max_jobs_per_day, payload_lbs) values ($1,$2,1,1000) returning id`,
      [sunshineId, `Seq Test Van ${randomUUID().slice(0, 8)}`]
    );
    const day = randomFutureDate();
    const bookingA = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    const bookingB = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });

    const first = await createCapacityHold({ bookingId: bookingA, providerOrgId: sunshineId, vehicleId: vehicle!.id, day, committed: true });
    const second = await createCapacityHold({ bookingId: bookingB, providerOrgId: sunshineId, vehicleId: vehicle!.id, day, committed: true });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
});

describe("atomic offer acceptance", () => {
  it("lets exactly one of two DIFFERENT providers win the same booking", async () => {
    const bookingId = await createMarketplaceBooking(randomFutureDate());
    const offers = await query<{ id: string; provider_org_id: string }>(`select id, provider_org_id from offers where booking_id = $1`, [bookingId]);
    const sunshineOffer = offers.find((o) => o.provider_org_id === sunshineId)!;
    const triOffer = offers.find((o) => o.provider_org_id === triCountyId)!;

    const [r1, r2] = await Promise.all([
      acceptOffer({ offerId: sunshineOffer.id, providerOrgId: sunshineId, vehicleId: sunshineVehicleId, crewMemberIds: sunshineCrewIds, actingUserId: sunshineOwnerId }),
      acceptOffer({ offerId: triOffer.id, providerOrgId: triCountyId, vehicleId: triVehicleId, crewMemberIds: triCrewIds, actingUserId: triOwnerId }),
    ]);

    expect([r1.ok, r2.ok].filter(Boolean).length).toBe(1);

    const assignments = await query(`select id from assignments where booking_id = $1`, [bookingId]);
    expect(assignments).toHaveLength(1);
    const booking = await queryOne<{ status: string }>(`select status from bookings where id = $1`, [bookingId]);
    expect(booking!.status).toBe("confirmed");
  });

  it("lets exactly one of two simultaneous clicks on the SAME offer win", async () => {
    const bookingId = await createMarketplaceBooking(randomFutureDate());
    const offer = await queryOne<{ id: string }>(`select id from offers where booking_id = $1 and provider_org_id = $2`, [bookingId, sunshineId]);

    const [r1, r2] = await Promise.all([
      acceptOffer({ offerId: offer!.id, providerOrgId: sunshineId, vehicleId: sunshineVehicleId, crewMemberIds: sunshineCrewIds, actingUserId: sunshineOwnerId }),
      acceptOffer({ offerId: offer!.id, providerOrgId: sunshineId, vehicleId: sunshineVehicleId, crewMemberIds: sunshineCrewIds, actingUserId: sunshineOwnerId }),
    ]);

    expect([r1.ok, r2.ok].filter(Boolean).length).toBe(1);
    const assignments = await query(`select id from assignments where booking_id = $1`, [bookingId]);
    expect(assignments).toHaveLength(1);
  });

  it("rejects acceptance once the booking already has an accepted offer (sequential)", async () => {
    const bookingId = await createMarketplaceBooking(randomFutureDate());
    const offers = await query<{ id: string; provider_org_id: string }>(`select id, provider_org_id from offers where booking_id = $1`, [bookingId]);
    const sunshineOffer = offers.find((o) => o.provider_org_id === sunshineId)!;
    const triOffer = offers.find((o) => o.provider_org_id === triCountyId)!;

    const first = await acceptOffer({ offerId: sunshineOffer.id, providerOrgId: sunshineId, vehicleId: sunshineVehicleId, crewMemberIds: sunshineCrewIds, actingUserId: sunshineOwnerId });
    expect(first.ok).toBe(true);

    const second = await acceptOffer({ offerId: triOffer.id, providerOrgId: triCountyId, vehicleId: triVehicleId, crewMemberIds: triCrewIds, actingUserId: triOwnerId });
    expect(second.ok).toBe(false);

    // The loser's offer must have been auto-cancelled, not left dangling as pending.
    const reloaded = await queryOne<{ status: string }>(`select status from offers where id = $1`, [triOffer.id]);
    expect(reloaded!.status).toBe("cancelled");
  });
});

describe("webhook idempotency", () => {
  it("processes a given provider+event id exactly once", async () => {
    const eventId = `evt_${randomUUID()}`;
    const first = await recordWebhookEventOnce("stripe", eventId);
    const second = await recordWebhookEventOnce("stripe", eventId);
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

describe("expired tracking links", () => {
  it("rejects a token past its expiry", async () => {
    const bookingId = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    const token = await createTrackingToken(bookingId);
    // Force it into the past directly (createTrackingToken always sets a future expiry).
    await query(`update tracking_tokens set expires_at = now() - interval '1 day' where token = $1`, [token]);

    const resolved = await resolveTrackingToken(token);
    expect(resolved).toBeNull();
  });

  it("resolves a valid, unexpired token", async () => {
    const bookingId = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    const token = await createTrackingToken(bookingId);
    const resolved = await resolveTrackingToken(token);
    expect(resolved?.bookingId).toBe(bookingId);
  });
});

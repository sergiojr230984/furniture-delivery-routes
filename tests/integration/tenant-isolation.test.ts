import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, queryOne } from "../../lib/db";
import { createDraftBooking, assertBookingOwnedByOrg } from "../../lib/booking-service";

let casaMiamiId: string;
let doralHomeId: string;
let salespersonId: string;

beforeAll(async () => {
  casaMiamiId = (await queryOne<{ id: string }>(`select id from organizations where name = 'Casa Miami Furniture'`))!.id;
  doralHomeId = (await queryOne<{ id: string }>(`select id from organizations where name = 'Doral Home Gallery'`))!.id;
  salespersonId = (await queryOne<{ id: string }>(`select id from users where email = 'sales@casamiami.demo'`))!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("tenant isolation", () => {
  it("lets a retailer act on its own booking", async () => {
    const bookingId = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    await expect(assertBookingOwnedByOrg(bookingId, casaMiamiId)).resolves.toBeUndefined();
  });

  it("blocks a different retailer org from touching the booking", async () => {
    const bookingId = await createDraftBooking({ retailerOrgId: casaMiamiId, createdBy: salespersonId, isDemo: true });
    await expect(assertBookingOwnedByOrg(bookingId, doralHomeId)).rejects.toThrow(/not found/i);
  });
});

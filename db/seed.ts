// Demo data seeder. Every record here is marked is_demo = true (or belongs
// to an org that is) so the app can clearly label seeded data and so a
// future "clear demo data" script has an unambiguous filter.
import "./env";
import { pool } from "../lib/db";
import { hashPassword } from "../lib/password";
import { EXAMPLE_PRICING_CONFIG } from "../lib/pricing";

const DEMO_PASSWORD = "demo1234";

// Relative to whenever the seed actually runs, so "expiring soon" stays
// genuinely soon (not already-expired) no matter when the demo is set up.
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pw = await hashPassword(DEMO_PASSWORD);

    // ---- Organizations -----------------------------------------------------
    const platform = await org(client, "platform", "Belliza Delivery", { is_demo: true });
    const bellizaCrew = await org(client, "provider", "Belliza Crew (Internal Fleet)", {
      is_demo: true,
      is_internal_fleet: true,
      status: "active",
    });

    const casaMiami = await org(client, "retailer", "Casa Miami Furniture", { is_demo: true });
    const doralHome = await org(client, "retailer", "Doral Home Gallery", { is_demo: true });
    const havanaFurniture = await org(client, "retailer", "Little Havana Furniture Co.", { is_demo: true });

    const sunshineMovers = await org(client, "provider", "Sunshine Movers Miami", {
      is_demo: true,
      status: "active",
    });
    const triCounty = await org(client, "provider", "Tri-County Delivery Partners", {
      is_demo: true,
      status: "pending_review",
    });

    // ---- Users --------------------------------------------------------------
    await user(client, platform.id, "platform_admin", "Ana Belliza", "admin@belliza.demo", pw);
    await user(client, platform.id, "dispatcher", "Marco Reyes", "dispatch@belliza.demo", pw);

    await user(client, casaMiami.id, "retailer_owner", "Julia Torres", "owner@casamiami.demo", pw);
    await user(client, casaMiami.id, "retailer_staff", "Diego Fernandez", "sales@casamiami.demo", pw);
    await user(client, doralHome.id, "retailer_owner", "Patricia Nunez", "owner@doralhome.demo", pw);
    await user(client, havanaFurniture.id, "retailer_owner", "Carlos Diaz", "owner@havanafurniture.demo", pw);

    const sunshineOwnerId = await user(
      client,
      sunshineMovers.id,
      "provider_owner",
      "Robert King",
      "owner@sunshinemovers.demo",
      pw
    );
    const sunshineCrewUserId = await user(
      client,
      sunshineMovers.id,
      "crew_member",
      "Luis Alvarez",
      "crew@sunshinemovers.demo",
      pw
    );
    await user(client, triCounty.id, "provider_owner", "Maria Gomez", "owner@tricounty.demo", pw);

    const bellizaCrewOwnerId = await user(
      client,
      bellizaCrew.id,
      "provider_owner",
      "Marco Reyes (Fleet)",
      "fleet@belliza.demo",
      pw
    );
    const bellizaCrewMemberUserId = await user(
      client,
      bellizaCrew.id,
      "crew_member",
      "Jorge Ramirez",
      "jorge.crew@belliza.demo",
      pw
    );
    const bellizaCrewMemberUser2Id = await user(
      client,
      bellizaCrew.id,
      "crew_member",
      "Wilfredo Santos",
      "wilfredo.crew@belliza.demo",
      pw
    );

    // ---- Belliza warehouse ----------------------------------------------------
    await client.query(
      `insert into belliza_warehouses (name, address_line1, city, state, postal_code, latitude, longitude)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      ["Belliza Distribution Center", "8200 NW 90th St", "Hialeah Gardens", "FL", "33016", 25.8825, -80.3486]
    );

    // ---- Retailer store locations ----------------------------------------------
    await location(client, casaMiami.id, "Casa Miami — Doral Showroom", "8455 NW 53rd St", "Doral", "33166", 25.814, -80.351, true);
    await location(client, casaMiami.id, "Casa Miami — Kendall", "8895 SW 132nd St", "Miami", "33176", 25.639, -80.393, false);
    await location(client, doralHome.id, "Doral Home Gallery", "3800 NW 87th Ave", "Doral", "33178", 25.803, -80.351, true);
    await location(client, havanaFurniture.id, "Little Havana Furniture Co.", "1600 SW 8th St", "Miami", "33135", 25.766, -80.221, true);

    // ---- Provider vehicles -------------------------------------------------
    await vehicle(client, bellizaCrew.id, "Belliza Van 1", "cargo_van", 120, 70, 60, 54, 3200, 5, "FL-BLZ01");
    await vehicle(client, bellizaCrew.id, "Belliza Box Truck", "box_truck", 168, 90, 84, 80, 6000, 6, "FL-BLZ02");
    await vehicle(client, sunshineMovers.id, "Sunshine Van A", "cargo_van", 110, 65, 58, 50, 3000, 5, "FL-SUN01");
    await vehicle(client, sunshineMovers.id, "Sunshine Box Truck", "box_truck", 156, 84, 78, 72, 5500, 6, "FL-SUN02");
    await vehicle(client, triCounty.id, "Tri-County Van", "cargo_van", 108, 62, 56, 48, 2800, 4, "FL-TRI01");

    // ---- Crew members ---------------------------------------------------------
    await crew(client, bellizaCrew.id, bellizaCrewMemberUserId, "Jorge Ramirez", true);
    await crew(client, bellizaCrew.id, bellizaCrewMemberUser2Id, "Wilfredo Santos", true);
    await crew(client, sunshineMovers.id, sunshineCrewUserId, "Luis Alvarez", true);
    await crew(client, sunshineMovers.id, null, "Pedro Suarez", false);
    await crew(client, triCounty.id, null, "Anthony Diaz", false);
    await crew(client, triCounty.id, null, "Kevin Brown", false);

    // ---- Provider documents ----------------------------------------------------
    await doc(client, sunshineMovers.id, "general_liability_insurance", "approved", daysFromNow(-365), daysFromNow(365));
    await doc(client, sunshineMovers.id, "business_license", "approved", daysFromNow(-600), daysFromNow(700));
    await doc(client, sunshineMovers.id, "auto_insurance", "approved", daysFromNow(-300), daysFromNow(12)); // expiring soon — for the dispatch alert demo
    await doc(client, triCounty.id, "general_liability_insurance", "pending_review", daysFromNow(-30), daysFromNow(335));
    await doc(client, triCounty.id, "business_license", "pending_review", daysFromNow(-30), daysFromNow(700));

    // ---- Saved product templates -----------------------------------------------
    await product(client, casaMiami.id, "Miravel Sofa", "sofa", 88, 38, 34, 145, false);
    await product(client, casaMiami.id, "Bexley Sectional (L-shape)", "sectional", 110, 88, 34, 260, false);
    await product(client, casaMiami.id, "Harlow Queen Bed Frame", "bed_frame", 82, 64, 48, 120, true);
    await product(client, casaMiami.id, "Kendall Dining Set (Table + 6 Chairs)", "dining_set", 72, 40, 30, 210, true);
    await product(client, doralHome.id, "Serena Sofa", "sofa", 84, 36, 33, 130, false);
    await product(client, havanaFurniture.id, "Vera Dresser", "dresser", 60, 20, 34, 140, false);

    // ---- Pricing rule set (labeled example, needs configuration) ---------------
    await client.query(
      `insert into pricing_rule_sets (version, label, status, config, created_by, activated_at)
       values (1, 'Example — configure before launch', 'active', $1::jsonb, $2, now())`,
      [JSON.stringify(EXAMPLE_PRICING_CONFIG), sunshineOwnerId ? bellizaCrewOwnerId : bellizaCrewOwnerId]
    );

    await client.query("COMMIT");
    console.log("Seed complete.");
    console.log(`All demo users share the password: ${DEMO_PASSWORD}`);
    console.log({
      platform: platform.id,
      bellizaCrew: bellizaCrew.id,
      casaMiami: casaMiami.id,
      doralHome: doralHome.id,
      havanaFurniture: havanaFurniture.id,
      sunshineMovers: sunshineMovers.id,
      triCounty: triCounty.id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function org(
  client: import("pg").PoolClient,
  type: "platform" | "retailer" | "provider",
  name: string,
  opts: { is_demo?: boolean; is_internal_fleet?: boolean; status?: string } = {}
) {
  const res = await client.query<{ id: string }>(
    `insert into organizations (type, name, is_internal_fleet, is_demo, status, contribution_floor_amount)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [type, name, opts.is_internal_fleet ?? false, opts.is_demo ?? false, opts.status ?? "active", 25]
  );
  return { id: res.rows[0].id, name };
}

async function user(
  client: import("pg").PoolClient,
  orgId: string,
  role: string,
  fullName: string,
  email: string,
  passwordHash: string
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `insert into users (org_id, role, full_name, email, password_hash) values ($1,$2,$3,$4,$5) returning id`,
    [orgId, role, fullName, email, passwordHash]
  );
  return res.rows[0].id;
}

async function location(
  client: import("pg").PoolClient,
  orgId: string,
  name: string,
  address: string,
  city: string,
  postal: string,
  lat: number,
  lng: number,
  isDefault: boolean
) {
  await client.query(
    `insert into retailer_locations (org_id, name, address_line1, city, state, postal_code, latitude, longitude, is_default)
     values ($1,$2,$3,$4,'FL',$5,$6,$7,$8)`,
    [orgId, name, address, city, postal, lat, lng, isDefault]
  );
}

async function vehicle(
  client: import("pg").PoolClient,
  orgId: string,
  name: string,
  type: string,
  lengthIn: number,
  widthIn: number,
  heightIn: number,
  doorWidthIn: number,
  payload: number,
  maxJobs: number,
  plate: string
) {
  await client.query(
    `insert into provider_vehicles (org_id, name, vehicle_type, cargo_length_in, cargo_width_in, cargo_height_in, door_width_in, payload_lbs, max_jobs_per_day, license_plate)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [orgId, name, type, lengthIn, widthIn, heightIn, doorWidthIn, payload, maxJobs, plate]
  );
}

async function crew(
  client: import("pg").PoolClient,
  orgId: string,
  userId: string | null,
  fullName: string,
  canAssemble: boolean
) {
  await client.query(
    `insert into crew_members (org_id, user_id, full_name, can_assemble) values ($1,$2,$3,$4)`,
    [orgId, userId, fullName, canAssemble]
  );
}

async function doc(
  client: import("pg").PoolClient,
  orgId: string,
  docType: string,
  status: string,
  issued: string,
  expires: string
) {
  await client.query(
    `insert into provider_documents (org_id, doc_type, file_path, issued_at, expires_at, status)
     values ($1,$2,$3,$4,$5,$6)`,
    [orgId, docType, `demo/${orgId}/${docType}.pdf`, issued, expires, status]
  );
}

async function product(
  client: import("pg").PoolClient,
  orgId: string,
  name: string,
  category: string,
  lengthIn: number,
  widthIn: number,
  heightIn: number,
  weightLbs: number,
  assembly: boolean
) {
  await client.query(
    `insert into saved_products (org_id, name, category, length_in, width_in, height_in, weight_lbs, default_assembly_required)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [orgId, name, category, lengthIn, widthIn, heightIn, weightLbs, assembly]
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

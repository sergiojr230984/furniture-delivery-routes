"use server";

import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import {
  createDraftBooking,
  replacePickups,
  replaceItems,
  upsertDestination,
  updateServiceOptions,
  generateQuote,
  confirmInternalBooking,
  requestMarketplaceFulfillment,
  assertBookingOwnedByOrg,
  type ItemInput,
} from "@/lib/booking-service";
import type { ItemCategory, PackagingCondition, ServiceLevel } from "@/lib/constants";

export async function startBookingAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  const locationId = String(formData.get("locationId") || "") || null;
  const id = await createDraftBooking({
    retailerOrgId: user.org_id,
    createdBy: user.id,
    retailerLocationId: locationId,
    isDemo: user.org.is_demo,
  });
  redirect(`/retailer/book/${id}/pickup`);
}

export async function savePickupAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  const pickupType = String(formData.get("pickupType") || "store") as "store" | "address" | "warehouse";
  let latitude: number | null = null;
  let longitude: number | null = null;
  let addressLine1: string | null = null;
  let city: string | null = null;
  let postalCode: string | null = null;
  let locationId: string | null = null;
  let warehouseId: string | null = null;

  if (pickupType === "store") {
    locationId = String(formData.get("locationId") || "");
    const loc = await queryOne<{ address_line1: string; city: string; postal_code: string; latitude: number | null; longitude: number | null }>(
      `select address_line1, city, postal_code, latitude, longitude from retailer_locations where id = $1 and org_id = $2`,
      [locationId, user.org_id]
    );
    if (loc) {
      addressLine1 = loc.address_line1;
      city = loc.city;
      postalCode = loc.postal_code;
      latitude = loc.latitude;
      longitude = loc.longitude;
    }
  } else if (pickupType === "warehouse") {
    warehouseId = String(formData.get("warehouseId") || "");
    const wh = await queryOne<{ address_line1: string; city: string; postal_code: string; latitude: number | null; longitude: number | null }>(
      `select address_line1, city, postal_code, latitude, longitude from belliza_warehouses where id = $1`,
      [warehouseId]
    );
    if (wh) {
      addressLine1 = wh.address_line1;
      city = wh.city;
      postalCode = wh.postal_code;
      latitude = wh.latitude;
      longitude = wh.longitude;
    }
  } else {
    addressLine1 = String(formData.get("addressLine1") || "");
    city = String(formData.get("city") || "Miami");
    postalCode = String(formData.get("postalCode") || "");
  }

  await replacePickups(bookingId, [
    {
      pickupType,
      locationId,
      warehouseId,
      warehouseOrderNumber: pickupType === "warehouse" ? String(formData.get("warehouseOrderNumber") || "") : null,
      addressLine1,
      city,
      postalCode,
      latitude,
      longitude,
      contactName: String(formData.get("contactName") || "") || null,
      contactPhone: String(formData.get("contactPhone") || "") || null,
      floor: formData.get("floor") ? Number(formData.get("floor")) : null,
      stairsFlights: Number(formData.get("stairsFlights") || 0),
      elevatorAvailable: formData.get("elevatorAvailable") === "on",
      instructions: String(formData.get("instructions") || "") || null,
    },
  ]);

  redirect(`/retailer/book/${bookingId}/items`);
}

export async function addItemAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  const existing = await query<ItemInput & { id: string; saved_product_id: string | null; length_in: string | null; width_in: string | null; height_in: string | null; weight_lbs: string | null; dims_unknown: boolean; packaging_condition: PackagingCondition; assembly_required: boolean; declared_value: string | null }>(
    `select * from booking_items where booking_id = $1`,
    [bookingId]
  );

  const savedProductId = String(formData.get("savedProductId") || "") || null;
  let item: ItemInput;

  if (savedProductId) {
    const p = await queryOne<{
      name: string;
      category: ItemCategory;
      length_in: string | null;
      width_in: string | null;
      height_in: string | null;
      weight_lbs: string | null;
      default_assembly_required: boolean;
    }>(`select name, category, length_in, width_in, height_in, weight_lbs, default_assembly_required from saved_products where id = $1 and org_id = $2`, [savedProductId, user.org_id]);
    if (!p) throw new Error("Saved product not found");
    item = {
      savedProductId,
      name: p.name,
      category: p.category,
      quantity: Number(formData.get("quantity") || 1),
      lengthIn: p.length_in ? parseFloat(p.length_in) : null,
      widthIn: p.width_in ? parseFloat(p.width_in) : null,
      heightIn: p.height_in ? parseFloat(p.height_in) : null,
      weightLbs: p.weight_lbs ? parseFloat(p.weight_lbs) : null,
      dimsUnknown: false,
      assemblyRequired: p.default_assembly_required,
      packagingCondition: "unknown",
    };
  } else {
    const dimsUnknown = formData.get("dimsUnknown") === "on";
    item = {
      name: String(formData.get("name") || "Item"),
      category: String(formData.get("category") || "misc") as ItemCategory,
      quantity: Number(formData.get("quantity") || 1),
      lengthIn: dimsUnknown ? null : Number(formData.get("lengthIn") || 0) || null,
      widthIn: dimsUnknown ? null : Number(formData.get("widthIn") || 0) || null,
      heightIn: dimsUnknown ? null : Number(formData.get("heightIn") || 0) || null,
      weightLbs: dimsUnknown ? null : Number(formData.get("weightLbs") || 0) || null,
      dimsUnknown,
      declaredValue: Number(formData.get("declaredValue") || 0) || null,
      packagingCondition: (String(formData.get("packagingCondition") || "unknown") as PackagingCondition),
      assemblyRequired: formData.get("assemblyRequired") === "on",
    };
  }

  await replaceItems(bookingId, [...existing.map(toItemInput), item]);
  redirect(`/retailer/book/${bookingId}/items`);
}

function toItemInput(row: any): ItemInput {
  return {
    savedProductId: row.saved_product_id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    lengthIn: row.length_in != null ? parseFloat(row.length_in) : null,
    widthIn: row.width_in != null ? parseFloat(row.width_in) : null,
    heightIn: row.height_in != null ? parseFloat(row.height_in) : null,
    weightLbs: row.weight_lbs != null ? parseFloat(row.weight_lbs) : null,
    dimsUnknown: row.dims_unknown,
    declaredValue: row.declared_value != null ? parseFloat(row.declared_value) : null,
    packagingCondition: row.packaging_condition,
    assemblyRequired: row.assembly_required,
  };
}

export async function removeItemAction(bookingId: string, itemId: string) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);
  await query(`delete from booking_items where id = $1 and booking_id = $2`, [itemId, bookingId]);
  redirect(`/retailer/book/${bookingId}/items`);
}

export async function continueToDestinationAction(bookingId: string) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);
  redirect(`/retailer/book/${bookingId}/destination`);
}

export async function saveDestinationAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  await upsertDestination(bookingId, {
    customerName: String(formData.get("customerName") || ""),
    customerPhone: String(formData.get("customerPhone") || ""),
    customerEmail: String(formData.get("customerEmail") || "") || null,
    addressLine1: String(formData.get("addressLine1") || ""),
    city: String(formData.get("city") || "Miami"),
    postalCode: String(formData.get("postalCode") || ""),
    floor: formData.get("floor") ? Number(formData.get("floor")) : null,
    stairsFlights: Number(formData.get("stairsFlights") || 0),
    elevatorAvailable: formData.get("elevatorAvailable") === "on",
    buildingHours: String(formData.get("buildingHours") || "") || null,
    parkingNotes: String(formData.get("parkingNotes") || "") || null,
    walkingDistanceFt: formData.get("walkingDistanceFt") ? Number(formData.get("walkingDistanceFt")) : null,
    instructions: String(formData.get("instructions") || "") || null,
  });

  redirect(`/retailer/book/${bookingId}/service`);
}

export async function saveServiceAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  await updateServiceOptions(bookingId, {
    serviceLevel: String(formData.get("serviceLevel") || "curbside") as ServiceLevel,
    priority: formData.get("priority") === "on",
    debrisRemoval: formData.get("debrisRemoval") === "on",
    oldFurnitureRemoval: formData.get("oldFurnitureRemoval") === "on",
  });

  redirect(`/retailer/book/${bookingId}/quote`);
}

export async function refreshQuoteAction(bookingId: string) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);
  await generateQuote(bookingId);
  redirect(`/retailer/book/${bookingId}/quote`);
}

export async function confirmInternalAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  const bellizaCrew = await queryOne<{ id: string }>(
    `select id from organizations where is_internal_fleet = true limit 1`
  );
  if (!bellizaCrew) throw new Error("No internal fleet organization configured");

  const [windowStart, windowEnd] = String(formData.get("window") || "09:00-12:00").split("-");
  const result = await confirmInternalBooking({
    bookingId,
    bellizaCrewOrgId: bellizaCrew.id,
    windowDate: String(formData.get("windowDate") || ""),
    windowStart,
    windowEnd,
    actingUserId: user.id,
  });

  if (!result.ok) {
    redirect(`/retailer/book/${bookingId}/quote?error=${encodeURIComponent(result.reason || "Could not confirm")}`);
  }
  redirect(`/retailer/bookings/${bookingId}`);
}

export async function requestMarketplaceAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  const [windowStart, windowEnd] = String(formData.get("window") || "09:00-12:00").split("-");
  const result = await requestMarketplaceFulfillment({
    bookingId,
    windowDate: String(formData.get("windowDate") || ""),
    windowStart,
    windowEnd,
    actingUserId: user.id,
  });

  if (!result.ok) {
    redirect(`/retailer/book/${bookingId}/quote?error=${encodeURIComponent(result.reason || "Could not submit")}`);
  }
  redirect(`/retailer/bookings/${bookingId}`);
}

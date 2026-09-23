"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";

export async function addVehicleAction(formData: FormData) {
  const user = await requireRoleOrThrow("provider_owner");
  await query(
    `insert into provider_vehicles (org_id, name, vehicle_type, cargo_length_in, cargo_width_in, cargo_height_in, door_width_in, payload_lbs, max_jobs_per_day, license_plate)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      user.org_id,
      String(formData.get("name") || ""),
      String(formData.get("vehicleType") || "cargo_van"),
      Number(formData.get("cargoLengthIn") || 0) || null,
      Number(formData.get("cargoWidthIn") || 0) || null,
      Number(formData.get("cargoHeightIn") || 0) || null,
      Number(formData.get("doorWidthIn") || 0) || null,
      Number(formData.get("payloadLbs") || 1500),
      Number(formData.get("maxJobsPerDay") || 5),
      String(formData.get("licensePlate") || "") || null,
    ]
  );
  revalidatePath("/provider/vehicles");
}

export async function setVehicleStatusAction(vehicleId: string, status: string) {
  const user = await requireRoleOrThrow("provider_owner");
  await query(`update provider_vehicles set status = $3 where id = $1 and org_id = $2`, [vehicleId, user.org_id, status]);
  revalidatePath("/provider/vehicles");
}

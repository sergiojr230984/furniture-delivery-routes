"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";

export async function addLocationAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner");
  await query(
    `insert into retailer_locations (org_id, name, address_line1, city, state, postal_code) values ($1,$2,$3,$4,'FL',$5)`,
    [user.org_id, String(formData.get("name") || ""), String(formData.get("addressLine1") || ""), String(formData.get("city") || "Miami"), String(formData.get("postalCode") || "")]
  );
  revalidatePath("/retailer/locations");
}

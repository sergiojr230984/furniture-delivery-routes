"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ItemCategory } from "@/lib/constants";

export async function addProductAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await query(
    `insert into saved_products (org_id, name, category, length_in, width_in, height_in, weight_lbs, default_assembly_required)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user.org_id,
      String(formData.get("name") || ""),
      String(formData.get("category") || "misc") as ItemCategory,
      Number(formData.get("lengthIn") || 0) || null,
      Number(formData.get("widthIn") || 0) || null,
      Number(formData.get("heightIn") || 0) || null,
      Number(formData.get("weightLbs") || 0) || null,
      formData.get("assemblyRequired") === "on",
    ]
  );
  revalidatePath("/retailer/products");
}

export async function deleteProductAction(productId: string) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await query(`delete from saved_products where id = $1 and org_id = $2`, [productId, user.org_id]);
  revalidatePath("/retailer/products");
}

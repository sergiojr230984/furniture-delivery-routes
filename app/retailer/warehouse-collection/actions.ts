"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";

export async function scheduleCollectionAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  const warehouseId = String(formData.get("warehouseId") || "");
  await query(
    `insert into warehouse_collection_appointments (retailer_org_id, warehouse_id, order_number, scheduled_at, driver_name, driver_phone, vehicle_plate, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user.org_id,
      warehouseId,
      String(formData.get("orderNumber") || ""),
      String(formData.get("scheduledAt") || ""),
      String(formData.get("driverName") || "") || null,
      String(formData.get("driverPhone") || "") || null,
      String(formData.get("vehiclePlate") || "") || null,
      user.id,
    ]
  );
  revalidatePath("/retailer/warehouse-collection");
}

export async function cancelCollectionAction(id: string) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await query(`update warehouse_collection_appointments set status = 'cancelled' where id = $1 and retailer_org_id = $2`, [id, user.org_id]);
  revalidatePath("/retailer/warehouse-collection");
}

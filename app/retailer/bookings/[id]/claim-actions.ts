"use server";

import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";

export async function fileClaimAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  await query(
    `insert into claims (booking_id, description, requested_amount, created_by) values ($1,$2,$3,$4)`,
    [bookingId, String(formData.get("description") || ""), Number(formData.get("requestedAmount") || 0) || null, user.id]
  );

  redirect(`/retailer/bookings/${bookingId}`);
}

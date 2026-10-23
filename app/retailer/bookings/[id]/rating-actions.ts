"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import { rateDelivery, AlreadyRatedError, NotRatableYetError } from "@/lib/ratings";

export async function rateDeliveryAction(bookingId: string, formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(bookingId, user.org_id);

  const rating = Number(formData.get("rating") || 0);
  const comment = String(formData.get("comment") || "").trim() || null;

  try {
    await rateDelivery({ bookingId, retailerOrgId: user.org_id, rating, comment, ratedBy: user.id });
  } catch (err) {
    const message = err instanceof AlreadyRatedError || err instanceof NotRatableYetError ? err.message : "Couldn't submit rating";
    redirect(`/retailer/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/retailer/bookings/${bookingId}`);
}

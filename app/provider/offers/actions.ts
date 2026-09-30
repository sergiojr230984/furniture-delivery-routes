"use server";

import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { acceptOffer, declineOffer } from "@/lib/offers";

export async function acceptOfferAction(offerId: string, formData: FormData) {
  const user = await requireRoleOrThrow("provider_owner");
  const vehicleId = String(formData.get("vehicleId") || "");
  const crewMemberIds = formData.getAll("crewMemberIds").map(String);

  if (!vehicleId || crewMemberIds.length < 2) {
    redirect(`/provider/offers/${offerId}?error=${encodeURIComponent("Select a vehicle and at least 2 crew members.")}`);
  }

  const result = await acceptOffer({
    offerId,
    providerOrgId: user.org_id,
    vehicleId,
    crewMemberIds,
    actingUserId: user.id,
  });

  if (!result.ok) {
    redirect(`/provider/offers/${offerId}?error=${encodeURIComponent(result.reason || "Could not accept offer")}`);
  }
  redirect(`/provider/routes`);
}

export async function declineOfferAction(offerId: string) {
  const user = await requireRoleOrThrow("provider_owner");
  await declineOffer(offerId, user.org_id);
  redirect(`/provider/offers`);
}

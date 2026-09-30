"use server";

import { redirect } from "next/navigation";
import { resolveAccessToken } from "@/lib/tracking";
import { query } from "@/lib/db";

export async function submitAccessDetailsAction(token: string, formData: FormData) {
  const resolved = await resolveAccessToken(token);
  if (!resolved) redirect(`/access/${token}`);

  await query(
    `update booking_destination set
       floor=$2, stairs_flights=$3, elevator_available=$4, building_hours=$5,
       parking_notes=$6, walking_distance_ft=$7, instructions=$8, access_completed=true
     where booking_id = $1`,
    [
      resolved!.bookingId,
      formData.get("floor") ? Number(formData.get("floor")) : null,
      Number(formData.get("stairsFlights") || 0),
      formData.get("elevatorAvailable") === "on",
      String(formData.get("buildingHours") || "") || null,
      String(formData.get("parkingNotes") || "") || null,
      formData.get("walkingDistanceFt") ? Number(formData.get("walkingDistanceFt")) : null,
      String(formData.get("instructions") || "") || null,
    ]
  );

  redirect(`/access/${token}?done=1`);
}

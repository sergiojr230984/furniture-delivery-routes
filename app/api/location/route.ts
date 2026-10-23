// Crew mobile client pings this while a job is en route (see
// components/LocationTracker.tsx). Silently ignored outside a trackable
// assignment status — see updateAssignmentLocation's TRACKABLE_STATUSES.
import { NextRequest, NextResponse } from "next/server";
import { requireRoleOrThrow } from "@/lib/auth";
import { assertAssignmentOwnedByCrewUser, updateAssignmentLocation } from "@/lib/crew-service";

export async function POST(req: NextRequest) {
  const user = await requireRoleOrThrow("crew_member");
  const body = await req.json().catch(() => null);
  const assignmentId = body?.assignmentId;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (typeof assignmentId !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid location payload" }, { status: 400 });
  }

  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const result = await updateAssignmentLocation({ assignmentId, lat, lng });
  return NextResponse.json(result);
}

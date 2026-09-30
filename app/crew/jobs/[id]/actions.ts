"use server";

import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import {
  assertAssignmentOwnedByCrewUser,
  advanceAssignment,
  addJobEvidence,
  reportIssue,
  AssignmentTransitionError,
  MissingEvidenceError,
} from "@/lib/crew-service";
import type { AssignmentStatus } from "@/lib/constants";

async function bookingIdFor(assignmentId: string): Promise<string> {
  const row = await queryOne<{ booking_id: string }>(`select booking_id from assignments where id = $1`, [assignmentId]);
  if (!row) throw new Error("Assignment not found");
  return row.booking_id;
}

export async function advanceStatusAction(assignmentId: string, to: AssignmentStatus) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  try {
    await advanceAssignment({ assignmentId, to, actorUserId: user.id });
  } catch (err) {
    if (err instanceof MissingEvidenceError || err instanceof AssignmentTransitionError) {
      redirect(`/crew/jobs/${assignmentId}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect(`/crew/jobs/${assignmentId}`);
}

export async function uploadPhotoAction(assignmentId: string, stage: string, formData: FormData) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const bookingId = await bookingIdFor(assignmentId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) redirect(`/crew/jobs/${assignmentId}?error=Choose a photo first`);

  const buf = Buffer.from(await file!.arrayBuffer());
  const ext = file!.type.split("/")[1] || "jpg";
  const key = await saveFile(buf, ext);

  await addJobEvidence({
    assignmentId,
    bookingId,
    stage,
    kind: "photo",
    filePath: key,
    meta: { caption: String(formData.get("caption") || "") },
    createdBy: user.id,
  });

  redirect(`/crew/jobs/${assignmentId}`);
}

export async function confirmChecklistAction(assignmentId: string, stage: string, formData: FormData) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const bookingId = await bookingIdFor(assignmentId);
  const items = formData.getAll("items").map(String);
  await addJobEvidence({ assignmentId, bookingId, stage, kind: "checklist", meta: { items }, createdBy: user.id });
  redirect(`/crew/jobs/${assignmentId}`);
}

export async function submitSignatureAction(assignmentId: string, formData: FormData) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const bookingId = await bookingIdFor(assignmentId);

  const file = formData.get("file") as File | null;
  const signerName = String(formData.get("signerName") || "");
  if (!file || file.size === 0) throw new Error("Signature image missing");

  const buf = Buffer.from(await file.arrayBuffer());
  const key = await saveFile(buf, "png");

  await addJobEvidence({
    assignmentId,
    bookingId,
    stage: "delivery_completed",
    kind: "signature",
    filePath: key,
    meta: { signerName },
    createdBy: user.id,
  });
}

export async function waiveSignatureAction(assignmentId: string, formData: FormData) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const bookingId = await bookingIdFor(assignmentId);
  const reason = String(formData.get("reason") || "Customer not present");
  await addJobEvidence({ assignmentId, bookingId, stage: "delivery_completed", kind: "signature_waived", meta: { reason }, createdBy: user.id });
  redirect(`/crew/jobs/${assignmentId}`);
}

export async function reportIssueAction(assignmentId: string, formData: FormData) {
  const user = await requireRoleOrThrow("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);
  const reason = String(formData.get("reason") || "Unspecified issue");
  await reportIssue({ assignmentId, reason, actorUserId: user.id });
  redirect(`/crew/jobs`);
}

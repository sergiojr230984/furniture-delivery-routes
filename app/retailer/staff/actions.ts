"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import { createInvite, revokeInvite, DuplicateInviteError, EmailAlreadyRegisteredError } from "@/lib/invites";

export async function inviteStaffAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  if (!email || !fullName) {
    redirect("/retailer/staff?error=" + encodeURIComponent("Fill in a name and email"));
  }

  try {
    await createInvite({ orgId: user.org_id, role: "retailer_staff", email, fullName, invitedBy: user.id });
  } catch (err) {
    const message =
      err instanceof DuplicateInviteError || err instanceof EmailAlreadyRegisteredError
        ? err.message
        : "Couldn't send the invite.";
    redirect("/retailer/staff?error=" + encodeURIComponent(message));
  }
  revalidatePath("/retailer/staff");
  redirect("/retailer/staff?success=" + encodeURIComponent(`Invite sent to ${fullName}.`));
}

export async function revokeInviteAction(inviteId: string) {
  const user = await requireRoleOrThrow("retailer_owner");
  await revokeInvite(inviteId, user.org_id);
  revalidatePath("/retailer/staff");
  redirect("/retailer/staff?success=" + encodeURIComponent("Invite revoked."));
}

export async function toggleStaffActiveAction(userId: string, active: boolean) {
  const user = await requireRoleOrThrow("retailer_owner");
  await query(`update users set active = $3 where id = $1 and org_id = $2 and role = 'retailer_staff'`, [userId, user.org_id, active]);
  revalidatePath("/retailer/staff");
  redirect(`/retailer/staff?success=${encodeURIComponent(active ? "Staff member activated." : "Staff member deactivated.")}`);
}

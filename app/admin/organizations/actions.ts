"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import { widenOffers } from "@/lib/offers";
import { redirect } from "next/navigation";

export async function setOrgStatusAction(orgId: string, status: "active" | "suspended" | "rejected") {
  const admin = await requireRoleOrThrow("platform_admin", "dispatcher");
  await query(`update organizations set status = $2 where id = $1`, [orgId, status]);
  await query(
    `insert into audit_log (actor_user_id, action, entity_type, entity_id, meta) values ($1,$2,'organization',$3,$4::jsonb)`,
    [admin.id, `org_status_${status}`, orgId, JSON.stringify({ status })]
  );
  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${orgId}`);
}

export async function reviewDocumentAction(docId: string, orgId: string, formData: FormData) {
  const admin = await requireRoleOrThrow("platform_admin", "dispatcher");
  const status = String(formData.get("status") || "approved");
  const notes = String(formData.get("notes") || "") || null;
  await query(`update provider_documents set status = $2, reviewed_by = $3, reviewed_at = now(), review_notes = $4 where id = $1`, [
    docId,
    status,
    admin.id,
    notes,
  ]);
  revalidatePath(`/admin/organizations/${orgId}`);
}

export async function widenOffersAction(bookingId: string) {
  const admin = await requireRoleOrThrow("platform_admin", "dispatcher");
  await widenOffers(bookingId, admin.id);
  redirect("/admin/dispatch");
}

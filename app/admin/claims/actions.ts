"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function resolveClaimAction(claimId: string, formData: FormData) {
  const admin = await requireRoleOrThrow("platform_admin", "dispatcher");
  const decision = String(formData.get("decision") || "denied"); // approved | denied
  const adjustment = Number(formData.get("adjustmentAmount") || 0) || 0;
  const notes = String(formData.get("notes") || "") || null;

  const claim = await queryOne<{ booking_id: string; is_demo: boolean }>(
    `select c.booking_id, b.is_demo from claims c join bookings b on b.id = c.booking_id where c.id = $1`,
    [claimId]
  );
  if (!claim) return;

  await query(
    `update claims set status = $2, decision_notes = $3, adjustment_amount = $4, resolved_by = $5, resolved_at = now() where id = $1`,
    [claimId, decision === "approved" ? "approved" : "denied", notes, decision === "approved" ? adjustment : null, admin.id]
  );

  if (decision === "approved" && adjustment > 0) {
    await query(
      `insert into ledger_entries (entry_type, booking_id, amount, currency, is_demo, notes) values ('claims_payout',$1,$2,'USD',$3,'Claim approved')`,
      [claim.booking_id, adjustment, claim.is_demo]
    );
  }

  revalidatePath("/admin/claims");
}

"use server";

import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query, queryOne, withTransaction } from "@/lib/db";

export async function createDraftRuleSetAction(formData: FormData) {
  const admin = await requireRoleOrThrow("platform_admin");
  const label = String(formData.get("label") || "Draft");
  const configText = String(formData.get("config") || "{}");

  let config: unknown;
  try {
    config = JSON.parse(configText);
  } catch {
    redirect("/admin/pricing?error=" + encodeURIComponent("Invalid JSON"));
  }

  const maxVersion = await queryOne<{ max: number }>(`select coalesce(max(version),0) as max from pricing_rule_sets`);
  await query(`insert into pricing_rule_sets (version, label, status, config, created_by) values ($1,$2,'draft',$3::jsonb,$4)`, [
    (maxVersion?.max ?? 0) + 1,
    label,
    JSON.stringify(config),
    admin.id,
  ]);

  redirect("/admin/pricing");
}

export async function activateRuleSetAction(ruleSetId: string) {
  const admin = await requireRoleOrThrow("platform_admin");
  await withTransaction(async (client) => {
    await client.query(`update pricing_rule_sets set status = 'archived' where status = 'active'`);
    await client.query(`update pricing_rule_sets set status = 'active', activated_at = now() where id = $1`, [ruleSetId]);
    await client.query(
      `insert into audit_log (actor_user_id, action, entity_type, entity_id) values ($1,'activate_rule_set','pricing_rule_set',$2)`,
      [admin.id, ruleSetId]
    );
  });
  redirect("/admin/pricing");
}

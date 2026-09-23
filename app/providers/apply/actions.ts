"use server";

import { redirect } from "next/navigation";
import { withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { currentAppMode } from "@/lib/constants";

export async function applyAsProviderAction(formData: FormData) {
  if (currentAppMode() === "pilot") {
    redirect("/providers/apply?error=" + encodeURIComponent("External provider onboarding is disabled during the internal pilot."));
  }

  const companyName = String(formData.get("companyName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const password = String(formData.get("password") || "");
  const serviceArea = String(formData.get("serviceArea") || "").trim();

  if (!companyName || !email || password.length < 8) {
    redirect("/providers/apply?error=" + encodeURIComponent("Fill in all required fields (password 8+ characters)."));
  }

  const hash = await hashPassword(password);

  const created = await withTransaction(async (client) => {
    const org = await client.query<{ id: string }>(
      `insert into organizations (type, name, status, contact_email, contact_phone, service_area_notes)
       values ('provider',$1,'pending_review',$2,$3,$4) returning id`,
      [companyName, email, phone || null, serviceArea || null]
    );
    const user = await client.query<{ id: string }>(
      `insert into users (org_id, role, full_name, email, password_hash) values ($1,'provider_owner',$2,$3,$4) returning id`,
      [org.rows[0].id, contactName || companyName, email, hash]
    );
    return { id: user.rows[0].id, orgId: org.rows[0].id };
  });

  await createSession({ userId: created.id, orgId: created.orgId, role: "provider_owner", locale: "en" });
  redirect("/provider/dashboard?applied=1");
}

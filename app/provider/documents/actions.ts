"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import { saveFile } from "@/lib/storage";

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireRoleOrThrow("provider_owner");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "pdf";
  const key = await saveFile(buf, ext);

  await query(
    `insert into provider_documents (org_id, doc_type, file_path, issued_at, expires_at, status)
     values ($1,$2,$3,$4,$5,'pending_review')`,
    [
      user.org_id,
      String(formData.get("docType") || "other"),
      key,
      String(formData.get("issuedAt") || "") || null,
      String(formData.get("expiresAt") || "") || null,
    ]
  );

  revalidatePath("/provider/documents");
}

"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/invites";
import { createSession } from "@/lib/session";
import { homePathForRole } from "@/lib/constants";

export async function acceptInviteAction(token: string, formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Password must be at least 8 characters")}`);
  }
  if (password !== confirm) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Passwords don't match")}`);
  }

  const result = await acceptInvite(token, password);
  if (!result) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite is no longer valid")}`);
  }

  await createSession({
    userId: result.userId,
    orgId: result.orgId,
    role: result.role,
    locale: "en",
  });
  redirect(homePathForRole(result.role));
}

"use server";

import { revalidatePath } from "next/cache";
import { requireRoleOrThrow } from "@/lib/auth";
import { autoBatchDay, reoptimizeRoute } from "@/lib/route-service";

export async function batchRouteAction(providerOrgId: string, vehicleId: string, date: string) {
  await requireRoleOrThrow("platform_admin", "dispatcher");
  await autoBatchDay(providerOrgId, vehicleId, date);
  revalidatePath("/admin/dispatch");
}

export async function reoptimizeRouteAction(routeId: string) {
  await requireRoleOrThrow("platform_admin", "dispatcher");
  await reoptimizeRoute(routeId);
  revalidatePath("/admin/dispatch");
}

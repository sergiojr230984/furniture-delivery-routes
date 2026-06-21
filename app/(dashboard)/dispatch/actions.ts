"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { autoDispatch } from "@/lib/optimize";

// Auto-assign a single on-demand order to the best same-day route.
export async function autoDispatchAction(formData: FormData) {
  const supabase = await createClient();
  const orderId = formData.get("order_id") as string;
  const result = await autoDispatch(supabase, orderId);

  revalidatePath("/dispatch");
  if (result.ok && result.routeId) {
    redirect(`/routes/${result.routeId}`);
  }
  redirect(`/dispatch?error=${encodeURIComponent(result.reason ?? "Could not dispatch")}`);
}

// Try to weave every unassigned on-demand order for a date into routes.
export async function autoDispatchAllAction(formData: FormData) {
  const supabase = await createClient();
  const date = (formData.get("date") as string) || new Date().toISOString().slice(0, 10);

  const { data: orders } = await supabase
    .from("delivery_orders")
    .select("id")
    .eq("scheduled_date", date)
    .eq("on_demand", true)
    .eq("status", "pending");

  let dispatched = 0;
  let failed = 0;
  for (const o of orders ?? []) {
    const result = await autoDispatch(supabase, o.id);
    if (result.ok) dispatched++;
    else failed++;
  }

  revalidatePath("/dispatch");
  redirect(`/dispatch?date=${date}&dispatched=${dispatched}&failed=${failed}`);
}

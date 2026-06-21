"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reoptimizeRoute } from "@/lib/optimize";

export async function createRoute(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  const { data, error } = await supabase
    .from("routes")
    .insert({
      name: get("name") ?? "Route",
      route_date: get("route_date"),
      vehicle_id: get("vehicle_id"),
      driver_id: get("driver_id"),
      helper_id: get("helper_id"),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create route");
  revalidatePath("/routes");
  redirect(`/routes/${data.id}`);
}

export async function updateRoute(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  const { error } = await supabase
    .from("routes")
    .update({
      vehicle_id: get("vehicle_id"),
      driver_id: get("driver_id"),
      helper_id: get("helper_id"),
      status: get("status") ?? "planning",
      start_time: get("start_time") ?? "08:00",
      avoid_tolls: formData.get("avoid_tolls") === "on",
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Speed / start-time / toll changes affect ETAs — refresh the schedule
  // without changing the manual stop order.
  await reoptimizeRoute(supabase, id, false);
  revalidatePath(`/routes/${id}`);
}

// Runs the optimisation engine: re-sequences stops + computes ETAs.
export async function optimizeRouteAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await reoptimizeRoute(supabase, id, true);
  revalidatePath(`/routes/${id}`);
}

// Adds a delivery order as the next stop, and marks the order "scheduled".
export async function addStop(formData: FormData) {
  const supabase = await createClient();
  const routeId = formData.get("route_id") as string;
  const orderId = formData.get("delivery_order_id") as string;

  const { data: existing } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.stop_order ?? 0) + 1;

  const { data: order } = await supabase
    .from("delivery_orders")
    .select("order_type")
    .eq("id", orderId)
    .single();

  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    delivery_order_id: orderId,
    stop_order: nextOrder,
    stop_type: order?.order_type ?? "delivery",
  });
  if (error) throw new Error(error.message);

  // Move a still-pending order to "scheduled" once it's on a route.
  await supabase
    .from("delivery_orders")
    .update({ status: "scheduled" })
    .eq("id", orderId)
    .eq("status", "pending");

  await reoptimizeRoute(supabase, routeId, false);
  revalidatePath(`/routes/${routeId}`);
}

export async function removeStop(formData: FormData) {
  const supabase = await createClient();
  const routeId = formData.get("route_id") as string;
  const stopId = formData.get("stop_id") as string;
  await supabase.from("route_stops").delete().eq("id", stopId);
  await reoptimizeRoute(supabase, routeId, false);
  revalidatePath(`/routes/${routeId}`);
}

// Swaps stop_order with the adjacent stop in the given direction.
export async function moveStop(formData: FormData) {
  const supabase = await createClient();
  const routeId = formData.get("route_id") as string;
  const stopId = formData.get("stop_id") as string;
  const direction = formData.get("direction") as string; // "up" | "down"

  const { data: stops } = await supabase
    .from("route_stops")
    .select("id, stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });

  if (!stops) return;
  const idx = stops.findIndex((s) => s.id === stopId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= stops.length) return;

  const a = stops[idx];
  const b = stops[swapIdx];
  await supabase.from("route_stops").update({ stop_order: b.stop_order }).eq("id", a.id);
  await supabase.from("route_stops").update({ stop_order: a.stop_order }).eq("id", b.id);
  await reoptimizeRoute(supabase, routeId, false);
  revalidatePath(`/routes/${routeId}`);
}

export async function deleteRoute(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("routes").delete().eq("id", id);
  revalidatePath("/routes");
  redirect("/routes");
}

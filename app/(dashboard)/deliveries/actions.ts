"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { matchZone, type ZoneLike, type GeoPoint } from "@/lib/routing";

interface ItemInput {
  description: string;
  sku?: string;
  quantity?: number;
  notes?: string;
}

// Creates a delivery order plus its line items, then opens the detail page.
export async function createDelivery(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };
  const num = (k: string) => {
    const v = get(k);
    return v !== null ? Number(v) : null;
  };

  const customerId = get("customer_id");
  const latitude = num("latitude");
  const longitude = num("longitude");
  const postalCode = get("postal_code");

  // Auto-assign a delivery zone from coordinates / postal code.
  const { data: zones } = await supabase
    .from("delivery_zones")
    .select("id, center_lat, center_lng, radius_km, postal_prefixes")
    .eq("active", true);
  const point: GeoPoint | null =
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null;
  const zoneId = matchZone((zones ?? []) as ZoneLike[], point, postalCode);

  const { data: order, error } = await supabase
    .from("delivery_orders")
    .insert({
      order_type: get("order_type") ?? "delivery",
      customer_id: customerId,
      status: "pending",
      scheduled_date: get("scheduled_date"),
      time_window_start: get("time_window_start"),
      time_window_end: get("time_window_end"),
      contact_name: get("contact_name"),
      contact_phone: get("contact_phone"),
      address_line1: get("address_line1"),
      address_line2: get("address_line2"),
      city: get("city"),
      state: get("state"),
      postal_code: postalCode,
      priority: Number(get("priority") ?? 0),
      notes: get("notes"),
      latitude,
      longitude,
      on_demand: formData.get("on_demand") === "on",
      service_minutes: num("service_minutes"),
      sla_deadline: get("sla_deadline"),
      zone_id: zoneId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !order) {
    throw new Error(error?.message ?? "Failed to create delivery order");
  }

  // Line items arrive as a JSON string built by the client form.
  const itemsRaw = formData.get("items");
  if (typeof itemsRaw === "string" && itemsRaw) {
    const items = JSON.parse(itemsRaw) as ItemInput[];
    const rows = items
      .filter((i) => i.description && i.description.trim() !== "")
      .map((i) => ({
        delivery_order_id: order.id,
        description: i.description.trim(),
        sku: i.sku?.trim() || null,
        quantity: Number(i.quantity) || 1,
        notes: i.notes?.trim() || null,
      }));
    if (rows.length > 0) {
      await supabase.from("delivery_items").insert(rows);
    }
  }

  revalidatePath("/deliveries");
  redirect(`/deliveries/${order.id}`);
}

// Updates status from the dispatcher detail view, with an optional note.
export async function updateOrderStatus(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  const note = formData.get("note") as string | null;

  const { error } = await supabase
    .from("delivery_orders")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Attach the optional note to the most recent history row for context.
  if (note && note.trim()) {
    await supabase.from("delivery_status_history").insert({
      delivery_order_id: id,
      status,
      notes: note.trim(),
    });
  }

  revalidatePath(`/deliveries/${id}`);
  revalidatePath("/deliveries");
}

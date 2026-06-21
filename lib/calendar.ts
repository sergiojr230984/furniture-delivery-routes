// Google Calendar helper. Uses a service-account credential so there is no
// OAuth redirect — the service account is invited to the shared business
// calendar once during setup.
//
// Required env vars:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — base-64 of the service-account JSON key
//   GOOGLE_CALENDAR_ID           — target calendar (e.g. primary, or an ID)
//
// No-ops silently when vars are absent.

import type { SupabaseClient } from "@supabase/supabase-js";

const configured =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_CALENDAR_ID;

function buildEventBody(route: {
  name: string;
  route_date: string;
  start_time: string;
  total_duration_min: number | null;
  driver?: { full_name: string } | null;
  helper?: { full_name: string } | null;
  vehicle?: { name: string } | null;
  stops?: Array<{
    stop_order: number;
    delivery_order?: {
      order_number: string | null;
      contact_name: string | null;
      address_line1: string | null;
      city: string | null;
    } | null;
  }>;
}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID!;

  // Build start/end datetimes.
  const startISO = `${route.route_date}T${route.start_time}:00`;
  const durationMin = route.total_duration_min ?? 240; // default 4 h
  const startMs = new Date(startISO).getTime();
  const endISO = new Date(startMs + durationMin * 60_000).toISOString();

  const crew = [
    route.driver?.full_name,
    route.helper ? `helper: ${route.helper.full_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const title = [route.name, route.vehicle?.name, crew]
    .filter(Boolean)
    .join(" — ");

  const stopLines = (route.stops ?? [])
    .sort((a, b) => a.stop_order - b.stop_order)
    .map((s) => {
      const o = s.delivery_order;
      if (!o) return `  Stop ${s.stop_order}`;
      const addr = [o.address_line1, o.city].filter(Boolean).join(", ");
      return `  Stop ${s.stop_order}: ${o.contact_name ?? o.order_number ?? "—"} — ${addr}`;
    })
    .join("\n");

  const description = [
    route.vehicle ? `Vehicle: ${route.vehicle.name}` : null,
    route.driver ? `Driver: ${route.driver.full_name}` : null,
    route.helper ? `Helper: ${route.helper.full_name}` : null,
    stopLines ? `\nStops:\n${stopLines}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { calendarId, title, startISO, endISO, description };
}

async function getCalendarClient() {
  const { google } = await import("googleapis");
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!, "base64").toString()
  );
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

export async function upsertRouteCalendarEvent(
  supabase: SupabaseClient,
  routeId: string
): Promise<void> {
  if (!configured) return;

  try {
    const { data: route } = await supabase
      .from("routes")
      .select(
        "*, vehicle:vehicles(name), driver:drivers(full_name), helper:drivers!routes_helper_id_fkey(full_name)"
      )
      .eq("id", routeId)
      .single();

    if (!route) return;

    const { data: stops } = await supabase
      .from("route_stops")
      .select(
        "stop_order, delivery_order:delivery_orders(order_number, contact_name, address_line1, city)"
      )
      .eq("route_id", routeId)
      .order("stop_order");

    const routeWithStops = { ...route, stops: stops ?? [] };
    const { calendarId, title, startISO, endISO, description } =
      buildEventBody(routeWithStops);

    const cal = await getCalendarClient();

    let eventId: string;

    if (route.calendar_event_id) {
      // Update existing event.
      const res = await cal.events.update({
        calendarId,
        eventId: route.calendar_event_id,
        requestBody: {
          summary: title,
          description,
          start: { dateTime: startISO },
          end: { dateTime: endISO },
        },
      });
      eventId = res.data.id!;
    } else {
      // Create new event.
      const res = await cal.events.insert({
        calendarId,
        requestBody: {
          summary: title,
          description,
          start: { dateTime: startISO },
          end: { dateTime: endISO },
        },
      });
      eventId = res.data.id!;
      // Persist the event ID so future updates can find it.
      await supabase
        .from("routes")
        .update({ calendar_event_id: eventId })
        .eq("id", routeId);
    }
  } catch (err) {
    console.error("[Calendar] Failed to upsert route event:", err);
  }
}

export async function deleteRouteCalendarEvent(
  calendarEventId: string
): Promise<void> {
  if (!configured) return;

  try {
    const cal = await getCalendarClient();
    await cal.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID!,
      eventId: calendarEventId,
    });
  } catch (err) {
    console.error("[Calendar] Failed to delete route event:", err);
  }
}

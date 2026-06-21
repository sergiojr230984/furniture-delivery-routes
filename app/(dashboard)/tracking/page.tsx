import Link from "next/link";
import { redirect } from "next/navigation";
import { Navigation, MapPin, Gauge, Crosshair, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isManager } from "@/lib/auth";
import AutoRefresh from "@/components/AutoRefresh";

// Minutes after which a crew is considered offline.
const ONLINE_WINDOW_MIN = 30;

function osmEmbed(lat: number, lng: number) {
  const d = 0.008;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export default async function TrackingPage() {
  const me = await getProfile();
  if (!isManager(me.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("driver_locations")
    .select("*, driver:drivers(full_name, crew_type), route:routes(name)")
    .order("updated_at", { ascending: false });

  const locations = (data ?? []) as {
    driver_id: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    updated_at: string;
    driver: { full_name: string; crew_type: string } | { full_name: string; crew_type: string }[] | null;
    route: { name: string } | { name: string }[] | null;
  }[];

  const now = Date.now();

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live tracking</h1>
          <p className="text-sm text-gray-500">
            Crew positions refresh automatically every 15s.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-sm text-gray-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Live
        </span>
      </div>

      {locations.length === 0 ? (
        <p className="card p-8 text-center text-sm text-gray-500">
          No crew is sharing their location yet. Drivers enable “Live location” in
          the driver app.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {locations.map((loc) => {
            const driver = Array.isArray(loc.driver) ? loc.driver[0] : loc.driver;
            const route = Array.isArray(loc.route) ? loc.route[0] : loc.route;
            const ageMin = (now - new Date(loc.updated_at).getTime()) / 60_000;
            const online = ageMin <= ONLINE_WINDOW_MIN;
            return (
              <div key={loc.driver_id} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Navigation className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-medium">{driver?.full_name || "Driver"}</p>
                      <p className="text-xs text-gray-500">
                        {route?.name ? `${route.name} · ` : ""}
                        updated {formatDistanceToNow(new Date(loc.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {online ? "Online" : "Offline"}
                  </span>
                </div>

                <iframe
                  title={`Map for ${driver?.full_name}`}
                  src={osmEmbed(loc.latitude, loc.longitude)}
                  className="h-56 w-full border-0"
                  loading="lazy"
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </span>
                  {loc.accuracy != null && (
                    <span className="flex items-center gap-1">
                      <Crosshair className="h-3.5 w-3.5" /> ±{Math.round(loc.accuracy)} m
                    </span>
                  )}
                  {loc.speed != null && loc.speed > 0 && (
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3.5 w-3.5" /> {Math.round(loc.speed * 3.6)} km/h
                    </span>
                  )}
                  <Link
                    href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                    target="_blank"
                    className="flex items-center gap-1 text-brand-600"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open in Maps
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

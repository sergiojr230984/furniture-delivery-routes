"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Navigation, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Lets a driver broadcast their live GPS position to dispatch.
// Uses the browser Geolocation API; pushes are throttled to ~every 12s.
export default function LocationSharer({
  driverId,
  routeId,
}: {
  driverId: string | null;
  routeId: string | null;
}) {
  const supabase = createClient();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPush = useRef<number>(0);

  // Resume sharing across navigations within the driver app.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("share_location") === "1") {
      start();
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function push(pos: GeolocationPosition) {
    const now = Date.now();
    if (now - lastPush.current < 12_000) return; // throttle
    lastPush.current = now;

    const { error } = await supabase.from("driver_locations").upsert(
      {
        driver_id: driverId,
        route_id: routeId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" }
    );
    if (error) setError(error.message);
    else setLastSent(new Date());
  }

  function start() {
    if (!driverId) {
      setError("Your login isn't linked to a driver record yet.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't available on this device.");
      return;
    }
    setError(null);
    setSharing(true);
    localStorage.setItem("share_location", "1");
    watchId.current = navigator.geolocation.watchPosition(
      push,
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
  }

  function stop() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
    if (typeof window !== "undefined") localStorage.removeItem("share_location");
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              sharing ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {sharing ? <Navigation className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold">Live location</p>
            <p className="text-xs text-gray-500">
              {sharing
                ? lastSent
                  ? `Sharing · updated ${lastSent.toLocaleTimeString()}`
                  : "Sharing · waiting for GPS…"
                : "Off"}
            </p>
          </div>
        </div>
        {sharing ? (
          <button onClick={stop} className="btn-secondary text-sm">
            Stop
          </button>
        ) : (
          <button onClick={start} className="btn-primary text-sm">
            Share
          </button>
        )}
      </div>
      {sharing && !lastSent && (
        <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> Acquiring position…
        </p>
      )}
      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
          <WifiOff className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

const MIN_PING_INTERVAL_MS = 20_000;

// Invisible — mounted on the crew job page only while an assignment is
// "en route" (see app/crew/jobs/[id]/page.tsx). Watches the device's
// position and throttles pings to the server so a flaky GPS fix doesn't
// spam the API. Fails silently: no location permission, no signal, no
// problem — this is a tracking *enhancement*, never something that should
// block or error out the actual delivery workflow.
export default function LocationTracker({ assignmentId }: { assignmentId: string }) {
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentAt.current < MIN_PING_INTERVAL_MS) return;
        lastSentAt.current = now;

        fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
          keepalive: true,
        }).catch(() => {
          // Offline or request failed — next successful fix will catch up.
        });
      },
      () => {
        // Permission denied or position unavailable — nothing to do.
      },
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 10_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [assignmentId]);

  return null;
}

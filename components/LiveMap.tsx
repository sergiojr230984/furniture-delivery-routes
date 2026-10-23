"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  kind: "driver" | "pickup" | "destination";
}

const MARKER_COLOR: Record<MapMarker["kind"], string> = {
  driver: "#ea580c", // orange-600 — matches the app's accent color
  pickup: "#1e3a8a", // navy-900
  destination: "#059669", // emerald-600
};

// Inline SVG pin per marker, so there's no dependency on Leaflet's default
// marker image assets — a well-known source of broken-icon bugs under
// Next.js/webpack bundling since the default icon URLs are relative paths
// that don't survive bundling unless copied into /public by hand.
function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="${color}"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, markers]);
  return null;
}

export default function LiveMap({ markers, height = "280px" }: { markers: MapMarker[]; height?: string }) {
  if (markers.length === 0) return null;

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg">
      <MapContainer
        center={[markers[0].lat, markers[0].lng]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        {/* OpenStreetMap tiles — free, no API key required. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={pinIcon(MARKER_COLOR[m.kind])}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

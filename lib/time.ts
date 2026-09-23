// America/New_York formatting helpers. Timestamps are always stored in UTC
// (Postgres `timestamptz`); this module only affects display, so DST
// transitions are handled correctly by the Intl/ICU tz database rather than
// a fixed offset.
import { TIME_ZONE } from "./constants";

export function formatDate(iso: string | Date, locale: "en" | "es" = "en"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | Date, locale: "en" | "es" = "en"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatTime(iso: string | Date, locale: "en" | "es" = "en"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

// Formats a SQL `time` value (HH:MM:SS) without timezone conversion — these
// are wall-clock window times already anchored to America/New_York.
export function formatWallTime(hhmmss: string | null): string {
  if (!hhmmss) return "";
  const [h, m] = hhmmss.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function todayInEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date()); // en-CA gives YYYY-MM-DD
}

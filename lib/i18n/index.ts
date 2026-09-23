import { cookies } from "next/headers";
import { dictionaries, type DictKey } from "./dictionaries";
import type { Locale } from "../constants";

const COOKIE_NAME = "belliza_locale";

export function t(locale: Locale, key: DictKey): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(COOKIE_NAME)?.value;
  return v === "es" ? "es" : "en";
}

export async function setLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

"use server";

import { setLocale } from "@/lib/i18n";
import type { Locale } from "@/lib/constants";

export async function setLocaleAction(locale: Locale) {
  await setLocale(locale);
}

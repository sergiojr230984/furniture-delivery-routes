"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/constants";
import { setLocaleAction } from "@/app/locale-actions";

export default function LocaleSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        className={`rounded px-2 py-1 ${locale === "en" ? "bg-navy-700 text-white" : "text-navy-500 hover:bg-navy-50"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("es")}
        disabled={pending}
        className={`rounded px-2 py-1 ${locale === "es" ? "bg-navy-700 text-white" : "text-navy-500 hover:bg-navy-50"}`}
      >
        ES
      </button>
    </div>
  );
}

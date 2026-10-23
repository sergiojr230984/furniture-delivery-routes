"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Small "copy to clipboard" affordance for the raw links this app shows in
// a few places (staff invite links, customer tracking links) — previously
// these were plain text the user had to manually select, which is
// especially awkward on a phone.
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (no permission, non-secure context) —
      // the link is still shown as text, so copying by hand still works.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-navy-200 bg-white px-2 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Drop-in replacement for <button type="submit">: shows a spinner and
// swaps the label while the enclosing form's action is in flight, and
// disables the button so a slow connection can't produce a double-submit.
// Every submit button in this app was previously static — on a slow
// connection (or just a full-page Server Action round-trip) there was no
// feedback that a tap registered at all.
export default function SubmitButton({
  children,
  pendingText,
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText ?? children : children}
    </button>
  );
}

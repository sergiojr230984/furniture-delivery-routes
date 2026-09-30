"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "./SignaturePad";

export default function SignatureCapture({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  function handleSave(blob: Blob, signerName: string) {
    const fd = new FormData();
    fd.append("file", blob, "signature.png");
    fd.append("signerName", signerName);
    startTransition(async () => {
      await action(fd);
      setDone(true);
      router.refresh();
    });
  }

  if (done) return <p className="text-sm text-emerald-700">Signature captured.</p>;
  return <SignaturePad onSave={handleSave} saving={pending} />;
}

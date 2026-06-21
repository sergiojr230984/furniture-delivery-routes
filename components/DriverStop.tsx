"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Package,
  Loader2,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/StatusBadge";
import SignaturePad from "@/components/SignaturePad";
import type { DeliveryOrder } from "@/lib/types";
import type { DeliveryStatus } from "@/lib/constants";

interface PhotoRef {
  id: string;
  url: string;
}
interface SigRef {
  id: string;
  signer: string | null;
  url: string;
}

export default function DriverStop({
  stopId,
  order,
  initialPhotos,
  initialSignatures,
}: {
  stopId: string;
  order: DeliveryOrder;
  initialPhotos: PhotoRef[];
  initialSignatures: SigRef[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [failReason, setFailReason] = useState("");
  const [showFail, setShowFail] = useState(false);

  const addr = [order.address_line1, order.city, order.state, order.postal_code]
    .filter(Boolean)
    .join(", ");

  // --- Status changes ---
  async function setStatus(status: DeliveryStatus, reason?: string) {
    setBusy(status);
    setError(null);

    const { error: e1 } = await supabase
      .from("delivery_orders")
      .update({ status })
      .eq("id", order.id);

    if (e1) {
      setError(e1.message);
      setBusy(null);
      return;
    }

    // Record arrival/completion on the stop.
    const stopPatch: Record<string, string> = {};
    if (status === "out_for_delivery") stopPatch.arrived_at = new Date().toISOString();
    if (status === "delivered" || status === "failed")
      stopPatch.completed_at = new Date().toISOString();
    if (Object.keys(stopPatch).length > 0) {
      await supabase.from("route_stops").update(stopPatch).eq("id", stopId);
    }

    // Log a reason note (e.g. failed delivery cause) to the history.
    if (reason && reason.trim()) {
      await supabase.from("delivery_status_history").insert({
        delivery_order_id: order.id,
        status,
        notes: reason.trim(),
      });
    }

    setBusy(null);
    setShowFail(false);
    router.refresh();
  }

  // --- Photo upload ---
  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("photo");
    setError(null);

    const path = `${order.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("delivery-photos")
      .upload(path, file, { upsert: false });

    if (upErr) {
      setError(upErr.message);
      setBusy(null);
      return;
    }

    await supabase.from("delivery_photos").insert({
      delivery_order_id: order.id,
      route_stop_id: stopId,
      storage_path: path,
    });

    setBusy(null);
    router.refresh();
  }

  // --- Signature ---
  async function saveSignature(blob: Blob, signerName: string) {
    setBusy("signature");
    setError(null);

    const path = `${order.id}/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabase.storage
      .from("signatures")
      .upload(path, blob, { contentType: "image/png" });

    if (upErr) {
      setError(upErr.message);
      setBusy(null);
      return;
    }

    await supabase.from("delivery_signatures").insert({
      delivery_order_id: order.id,
      route_stop_id: stopId,
      signer_name: signerName || null,
      storage_path: path,
    });

    setBusy(null);
    router.refresh();
  }

  // --- Notes ---
  async function saveNote() {
    if (!note.trim()) return;
    setBusy("note");
    await supabase
      .from("delivery_orders")
      .update({ notes: note.trim() })
      .eq("id", order.id);
    setBusy(null);
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-bold">{order.order_number}</span>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-lg font-semibold">
          {order.customer?.name || order.contact_name || "Customer"}
        </p>
        <div className="mt-2 space-y-1 text-sm text-gray-600">
          {addr && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-brand-600"
            >
              <MapPin className="h-4 w-4" /> {addr}
            </a>
          )}
          {order.contact_phone && (
            <a href={`tel:${order.contact_phone}`} className="flex items-center gap-2 text-brand-600">
              <Phone className="h-4 w-4" /> {order.contact_phone}
            </a>
          )}
        </div>
      </div>

      {/* Items */}
      {order.delivery_items && order.delivery_items.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> Items
          </h2>
          <ul className="space-y-1 text-sm">
            {order.delivery_items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.description}</span>
                <span className="text-gray-500">×{it.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Existing notes */}
      {order.notes && (
        <div className="card flex items-start gap-2 p-4 text-sm text-gray-700">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          {order.notes}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Status actions */}
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold">Update status</h2>
        <button
          onClick={() => setStatus("out_for_delivery")}
          disabled={busy !== null}
          className="btn-secondary w-full"
        >
          {busy === "out_for_delivery" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Mark out for delivery
        </button>
        <button
          onClick={() => setStatus("delivered")}
          disabled={busy !== null}
          className="btn-success w-full"
        >
          {busy === "delivered" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Mark delivered
        </button>

        {!showFail ? (
          <button onClick={() => setShowFail(true)} disabled={busy !== null} className="btn-danger w-full">
            <XCircle className="h-4 w-4" /> Mark failed
          </button>
        ) : (
          <div className="space-y-2 rounded-lg border border-red-200 p-3">
            <input
              className="input"
              placeholder="Reason for failure"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowFail(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => setStatus("failed", failReason)}
                disabled={busy !== null}
                className="btn-danger flex-1"
              >
                Confirm failed
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setStatus("rescheduled")}
          disabled={busy !== null}
          className="btn-secondary w-full"
        >
          Reschedule
        </button>
      </div>

      {/* Proof: photos */}
      <div className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Camera className="h-4 w-4" /> Proof photos
        </h2>
        {initialPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {initialPhotos.map((p) =>
              p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt="Proof" className="aspect-square w-full rounded-lg object-cover" />
              ) : null
            )}
          </div>
        )}
        <label className="btn-secondary w-full cursor-pointer">
          {busy === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Take / upload photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={uploadPhoto}
            disabled={busy !== null}
          />
        </label>
      </div>

      {/* Proof: signature */}
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Customer signature</h2>
        {initialSignatures.length > 0 ? (
          <div className="space-y-2">
            {initialSignatures.map((s) =>
              s.url ? (
                <div key={s.id} className="rounded-lg border border-gray-200 p-2">
                  <p className="mb-1 text-xs text-gray-500">Signed by {s.signer || "—"}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="Signature" className="h-20 bg-white object-contain" />
                </div>
              ) : null
            )}
          </div>
        ) : (
          <SignaturePad onSave={saveSignature} saving={busy === "signature"} />
        )}
      </div>

      {/* Notes */}
      <div className="card space-y-2 p-4">
        <h2 className="font-semibold">Delivery notes</h2>
        <textarea
          className="input"
          rows={3}
          placeholder="Add a note for this delivery…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button onClick={saveNote} disabled={busy !== null || !note.trim()} className="btn-primary w-full">
          Save note
        </button>
      </div>
    </div>
  );
}

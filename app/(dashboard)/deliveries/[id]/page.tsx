import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Calendar, Clock, FileText } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import StatusUpdater from "@/components/StatusUpdater";
import {
  STATUS_LABELS,
  ORDER_TYPE_LABELS,
  type DeliveryStatus,
} from "@/lib/constants";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("delivery_orders")
    .select("*, customer:customers(*), delivery_items(*)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  const [historyRes, photosRes, sigRes] = await Promise.all([
    supabase
      .from("delivery_status_history")
      .select("*")
      .eq("delivery_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_photos")
      .select("*")
      .eq("delivery_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_signatures")
      .select("*")
      .eq("delivery_order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Sign private storage paths so the dispatcher can view proof-of-delivery.
  const photoUrls = await Promise.all(
    (photosRes.data ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("delivery-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl };
    })
  );
  const sigUrls = await Promise.all(
    (sigRes.data ?? []).map(async (s) => {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(s.storage_path, 3600);
      return { ...s, url: data?.signedUrl };
    })
  );

  const addr = [order.address_line1, order.address_line2, order.city, order.state, order.postal_code]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/deliveries" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to deliveries
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <StatusBadge status={order.status as DeliveryStatus} />
          </div>
          <p className="text-sm text-gray-500">
            {ORDER_TYPE_LABELS[order.order_type as "delivery" | "pickup"]}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Details */}
          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-semibold">
              {order.customer?.name || order.contact_name || "Customer"}
            </h2>
            <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
              {order.contact_phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" /> {order.contact_phone}
                </p>
              )}
              {addr && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" /> {addr}
                </p>
              )}
              {order.scheduled_date && (
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" /> {order.scheduled_date}
                </p>
              )}
              {(order.time_window_start || order.time_window_end) && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  {order.time_window_start ?? "—"} to {order.time_window_end ?? "—"}
                </p>
              )}
            </div>
            {order.notes && (
              <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                {order.notes}
              </p>
            )}
          </section>

          {/* Items */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Items</h2>
            {order.delivery_items && order.delivery_items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {order.delivery_items.map((it: { id: string; description: string; sku: string | null; quantity: number }) => (
                    <tr key={it.id} className="border-b border-gray-50">
                      <td className="py-2">{it.description}</td>
                      <td className="py-2 text-gray-500">{it.sku || "—"}</td>
                      <td className="py-2 text-right">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-500">No items listed.</p>
            )}
          </section>

          {/* Proof of delivery */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Proof of delivery</h2>
            {photoUrls.length === 0 && sigUrls.length === 0 ? (
              <p className="text-sm text-gray-500">
                No photos or signature captured yet.
              </p>
            ) : (
              <div className="space-y-4">
                {photoUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photoUrls.map((p) =>
                      p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={p.id} src={p.url} alt={p.caption ?? "Proof photo"}
                          className="aspect-square w-full rounded-lg object-cover" />
                      ) : null
                    )}
                  </div>
                )}
                {sigUrls.map((s) =>
                  s.url ? (
                    <div key={s.id} className="rounded-lg border border-gray-200 p-3">
                      <p className="mb-2 text-xs text-gray-500">
                        Signed by {s.signer_name || "—"}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="Signature" className="h-24 bg-white object-contain" />
                    </div>
                  ) : null
                )}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <section className="card p-5">
            <StatusUpdater id={order.id} current={order.status as DeliveryStatus} />
          </section>

          {/* History */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">History</h2>
            <ol className="space-y-3">
              {(historyRes.data ?? []).map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="font-medium">
                      {STATUS_LABELS[h.status as DeliveryStatus]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(h.created_at), "MMM d, yyyy · HH:mm")}
                    </p>
                    {h.notes && <p className="text-gray-600">{h.notes}</p>}
                  </div>
                </li>
              ))}
              {(historyRes.data ?? []).length === 0 && (
                <li className="text-sm text-gray-500">No history yet.</li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

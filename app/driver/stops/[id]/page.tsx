import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DriverStop from "@/components/DriverStop";

export default async function DriverStopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: stop } = await supabase
    .from("route_stops")
    .select(
      "*, delivery_order:delivery_orders(*, customer:customers(name), delivery_items(*))"
    )
    .eq("id", id)
    .single();

  if (!stop || !stop.delivery_order) notFound();
  const order = stop.delivery_order;

  const [photosRes, sigRes] = await Promise.all([
    supabase
      .from("delivery_photos")
      .select("*")
      .eq("delivery_order_id", order.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_signatures")
      .select("*")
      .eq("delivery_order_id", order.id)
      .order("created_at", { ascending: false }),
  ]);

  const photoUrls = await Promise.all(
    (photosRes.data ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("delivery-photos")
        .createSignedUrl(p.storage_path, 3600);
      return { id: p.id, url: data?.signedUrl ?? "" };
    })
  );

  const sigInfo = await Promise.all(
    (sigRes.data ?? []).map(async (s) => {
      const { data } = await supabase.storage
        .from("signatures")
        .createSignedUrl(s.storage_path, 3600);
      return { id: s.id, signer: s.signer_name, url: data?.signedUrl ?? "" };
    })
  );

  return (
    <div className="space-y-4">
      <Link href="/driver" className="flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeft className="h-4 w-4" /> Back to routes
      </Link>
      <DriverStop
        stopId={stop.id}
        order={order}
        initialPhotos={photoUrls}
        initialSignatures={sigInfo}
      />
    </div>
  );
}

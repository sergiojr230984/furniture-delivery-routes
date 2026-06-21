import { createClient } from "@/lib/supabase/server";
import ZonesManager from "@/components/ZonesManager";
import type { DeliveryZone } from "@/lib/types";

export default async function ZonesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_zones").select("*").order("name");
  return <ZonesManager initial={(data ?? []) as DeliveryZone[]} />;
}

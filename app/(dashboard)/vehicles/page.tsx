import { createClient } from "@/lib/supabase/server";
import VehiclesManager from "@/components/VehiclesManager";
import type { Vehicle } from "@/lib/types";

export default async function VehiclesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*").order("name");
  return <VehiclesManager initial={(data ?? []) as Vehicle[]} />;
}

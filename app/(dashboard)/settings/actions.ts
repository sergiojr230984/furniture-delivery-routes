"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== "" ? Number(v) : null;
  };

  const { error } = await supabase.from("org_settings").upsert({
    id: 1,
    depot_name: (formData.get("depot_name") as string) || null,
    depot_address: (formData.get("depot_address") as string) || null,
    depot_lat: num("depot_lat"),
    depot_lng: num("depot_lng"),
    default_service_minutes: num("default_service_minutes") ?? 15,
    default_avg_speed_kmh: num("default_avg_speed_kmh") ?? 40,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

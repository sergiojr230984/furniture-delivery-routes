import { createClient } from "@/lib/supabase/server";
import CustomersManager from "@/components/CustomersManager";
import type { Customer } from "@/lib/types";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("name");
  return <CustomersManager initial={(data ?? []) as Customer[]} />;
}

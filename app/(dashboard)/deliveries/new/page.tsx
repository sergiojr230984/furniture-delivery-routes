import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import DeliveryForm from "@/components/DeliveryForm";
import type { Customer } from "@/lib/types";

export default async function NewDeliveryPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/deliveries" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to deliveries
      </Link>
      <h1 className="text-2xl font-bold">New delivery order</h1>
      <DeliveryForm customers={(customers ?? []) as Customer[]} />
    </div>
  );
}

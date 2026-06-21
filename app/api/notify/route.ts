// Called by the driver's mobile client after marking a stop "out for delivery".
// Fetches order details server-side and sends the customer an SMS.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOutForDeliverySMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Require an authenticated session.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const { data: order } = await supabase
    .from("delivery_orders")
    .select("contact_phone, contact_name, order_number, address_line1, city")
    .eq("id", orderId)
    .single();

  if (!order?.contact_phone) {
    return NextResponse.json({ skipped: "no phone" });
  }

  const address = [order.address_line1, order.city].filter(Boolean).join(", ");

  await sendOutForDeliverySMS({
    phone: order.contact_phone,
    contactName: order.contact_name,
    orderNumber: order.order_number,
    address: address || null,
  });

  return NextResponse.json({ ok: true });
}

// Twilio SMS helper. No-ops silently when env vars are absent so the app
// works without credentials until you're ready to activate it.

const configured =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER;

export async function sendOutForDeliverySMS(opts: {
  phone: string;
  contactName: string | null;
  orderNumber: string | null;
  address: string | null;
}): Promise<void> {
  if (!configured) return;

  const name = opts.contactName?.split(" ")[0] ?? "there";
  const addr = opts.address ? ` to ${opts.address}` : "";
  const body =
    `Hi ${name}! Your La Cuevita furniture delivery` +
    `${addr} is on its way. We'll see you soon!`;

  // Lazy-import so the module is never loaded when vars are absent.
  const Twilio = (await import("twilio")).default;
  const client = Twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  try {
    await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to: opts.phone,
      body,
    });
  } catch (err) {
    // Log but never crash the main operation.
    console.error("[SMS] Failed to send message:", err);
  }
}

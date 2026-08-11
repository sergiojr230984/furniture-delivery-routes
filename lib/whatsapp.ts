// WhatsApp Cloud API (Meta Business) helper. No-ops silently when env vars
// are absent so the app works without credentials until you're ready to
// activate it — same pattern as lib/sms.ts and lib/calendar.ts.
//
// Required env vars:
//   WHATSAPP_ACCESS_TOKEN         — permanent access token (System User)
//   WHATSAPP_PHONE_NUMBER_ID      — the "Phone number ID" from API Setup
//
// Optional env vars:
//   WHATSAPP_API_VERSION              — Graph API version (default v21.0)
//   WHATSAPP_TEMPLATE_DAY_BEFORE      — template name for the day-before
//                                       reminder (default "delivery_reminder")
//   WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY — template name for the "on the way"
//                                       notice (default "out_for_delivery")
//   WHATSAPP_TEMPLATE_LANG            — template language code (default en_US)
//
// Business-initiated messages outside a 24h customer-service window must use
// a pre-approved Message Template (Meta Business Manager → Account tools →
// Message templates). The two templates used here must be approved with a
// single body variable count matching what's sent below:
//   delivery_reminder   — {{1}} name  {{2}} order #  {{3}} date  {{4}} window
//   out_for_delivery    — {{1}} name  {{2}} address

const configured =
  !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

// Graph API wants digits only (country code + number, no "+", spaces or dashes).
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

async function sendTemplateMessage(
  to: string,
  templateName: string,
  bodyParams: string[]
): Promise<void> {
  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${detail}`);
  }
}

// --- Day-before reminder (sent by the daily cron) ---------------------------
// Returns whether the message actually went out, so the caller (the cron
// route) only marks an order as reminded once it's confirmed sent — a
// transient failure gets retried on the next run instead of being silently
// dropped.
export async function sendDeliveryReminderWhatsApp(opts: {
  phone: string;
  contactName: string | null;
  orderNumber: string | null;
  scheduledDate: string; // formatted for display, e.g. "Tue, Aug 12"
  timeWindow: string; // e.g. "9:00 AM – 12:00 PM" or "your scheduled window"
}): Promise<boolean> {
  if (!configured) return false;

  const name = opts.contactName?.split(" ")[0] ?? "there";
  const templateName =
    process.env.WHATSAPP_TEMPLATE_DAY_BEFORE || "delivery_reminder";

  try {
    await sendTemplateMessage(opts.phone, templateName, [
      name,
      opts.orderNumber ?? "—",
      opts.scheduledDate,
      opts.timeWindow,
    ]);
    return true;
  } catch (err) {
    console.error("[WhatsApp] Failed to send day-before reminder:", err);
    return false;
  }
}

// --- "Out for delivery" notice (sent when a driver marks a stop on the way) -
export async function sendOutForDeliveryWhatsApp(opts: {
  phone: string;
  contactName: string | null;
  orderNumber: string | null;
  address: string | null;
}): Promise<void> {
  if (!configured) return;

  const name = opts.contactName?.split(" ")[0] ?? "there";
  const templateName =
    process.env.WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY || "out_for_delivery";

  try {
    await sendTemplateMessage(opts.phone, templateName, [
      name,
      opts.address || "your address",
    ]);
  } catch (err) {
    console.error("[WhatsApp] Failed to send out-for-delivery notice:", err);
  }
}

import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { isStripeConfigured } from "@/lib/payments";

export default async function AdminNotificationsPage() {
  await requireRole("platform_admin", "dispatcher");
  const notifications = await query<{
    channel: string;
    to_address: string;
    subject: string | null;
    body: string;
    status: string;
    created_at: string;
    booking_number: string | null;
  }>(
    `select n.channel, n.to_address, n.subject, n.body, n.status, n.created_at, b.booking_number
     from notifications_outbox n left join bookings b on b.id = n.booking_id
     order by n.created_at desc limit 100`
  );

  const smsConfigured = !!process.env.TWILIO_ACCOUNT_SID;
  const emailConfigured = !!process.env.SMTP_URL;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy-900">Notifications</h1>
      <div className="card grid grid-cols-3 gap-4 p-4 text-sm">
        <IntegrationStatus label="SMS (Twilio)" configured={smsConfigured} />
        <IntegrationStatus label="Email (SMTP)" configured={emailConfigured} />
        <IntegrationStatus label="Payments (Stripe)" configured={isStripeConfigured()} />
      </div>

      <div className="card divide-y divide-navy-100">
        {notifications.map((n, i) => (
          <div key={i} className="p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-navy-800">
                {n.channel.toUpperCase()} to {n.to_address} {n.booking_number && `· ${n.booking_number}`}
              </span>
              <span className={`badge ${n.status === "sent" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-navy-100 bg-navy-50 text-navy-500"}`}>
                {n.status === "sent" ? "sent" : "demo (simulated)"}
              </span>
            </div>
            <p className="mt-1 text-navy-600">{n.body}</p>
            <p className="mt-1 text-xs text-navy-400">{formatDateTime(n.created_at)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationStatus({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div>
      <div className="text-navy-500">{label}</div>
      <div className={configured ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
        {configured ? "Configured" : "Not configured (demo outbox)"}
      </div>
    </div>
  );
}

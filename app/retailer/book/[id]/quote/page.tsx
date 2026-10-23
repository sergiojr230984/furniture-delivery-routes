import { requireRole } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  assertBookingOwnedByOrg,
  generateQuote,
  getInternalAvailability,
} from "@/lib/booking-service";
import { confirmInternalAction, requestMarketplaceAction } from "../../actions";
import BookingWizardSteps from "@/components/BookingWizardSteps";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { currentAppMode } from "@/lib/constants";
import type { Booking } from "@/lib/types";

const WINDOWS = ["09:00-12:00", "12:00-15:00", "15:00-18:00"];

export default async function QuoteStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  let booking = await queryOne<Booking>(`select * from bookings where id = $1`, [id]);
  if (!booking) throw new Error("Booking not found");

  if (booking.status === "draft" || booking.status === "quote_ready") {
    await generateQuote(id);
    booking = await queryOne<Booking>(`select * from bookings where id = $1`, [id]);
  }
  const quote = booking!.quote!;

  const bellizaCrew = await queryOne<{ id: string }>(`select id from organizations where is_internal_fleet = true limit 1`);
  const availability = bellizaCrew ? await getInternalAvailability(bellizaCrew.id, 10) : [];
  const bookableDays = availability.filter((a) => a.remainingSlots > 0);

  const mode = currentAppMode();
  const alreadyDecided = booking!.status !== "draft" && booking!.status !== "quote_ready";

  return (
    <div className="mx-auto max-w-lg">
      <BookingWizardSteps current="quote" />
      <h1 className="text-2xl font-bold text-navy-900">Quote &amp; availability</h1>

      <div className="mt-4">
        <Flash error={error && decodeURIComponent(error)} />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-3 font-semibold text-navy-800">Itemized price</h2>
        <ul className="divide-y divide-navy-100 text-sm">
          {quote.lineItems.map((li, i) => (
            <li key={i} className="flex justify-between py-1.5">
              <span className="text-navy-600">{li.label}</span>
              <span className="text-navy-800">{formatMoney(li.amount)}</span>
            </li>
          ))}
          {quote.discountAmount > 0 && (
            <li className="flex justify-between py-1.5 text-emerald-700">
              <span>Discount ({quote.discountPercent}%)</span>
              <span>-{formatMoney(quote.discountAmount)}</span>
            </li>
          )}
        </ul>
        <div className="mt-3 flex justify-between border-t border-navy-200 pt-3 text-lg font-bold text-navy-900">
          <span>Total</span>
          <span>{formatMoney(quote.total)}</span>
        </div>
        <p className="mt-2 text-xs text-navy-400">Rate sheet v{quote.ruleSetVersion} · Cancellation: full refund up to 24h before the window; after that a $50 change fee may apply.</p>
      </div>

      {quote.needsReview && (
        <div className="card mt-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">This booking needs manual review before it can be marked confirmed:</p>
          <ul className="ml-4 mt-1 list-disc">
            {quote.reviewReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {alreadyDecided ? (
        <div className="card mt-4 p-5 text-sm text-navy-600">
          This booking is already <strong>{booking!.status.replace(/_/g, " ")}</strong>. See the{" "}
          <a className="text-orange-600 underline" href={`/retailer/bookings/${id}`}>
            booking detail page
          </a>{" "}
          for status and tracking.
        </div>
      ) : (
        <>
          <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-navy-400">Choose how to fulfill this delivery</p>

          <div className="card space-y-3 border-2 border-emerald-200 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy-800">Belliza crew</h2>
              <span className="badge border-emerald-200 bg-emerald-50 text-emerald-700">Recommended · Instant</span>
            </div>
            <p className="text-xs text-navy-500">Confirmed immediately — no waiting on anyone to accept.</p>
            {bookableDays.length === 0 ? (
              <p className="text-sm text-navy-500">No internal capacity in the next 10 days. Use the delivery network below instead.</p>
            ) : (
              <form action={confirmInternalAction.bind(null, id)} className="space-y-3">
                <select className="input" name="windowDate" required>
                  {bookableDays.map((d) => (
                    <option key={d.date} value={d.date}>
                      {formatDate(d.date)} ({d.remainingSlots} slot{d.remainingSlots === 1 ? "" : "s"} left)
                    </option>
                  ))}
                </select>
                <select className="input" name="window" required>
                  {WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <SubmitButton pendingText="Confirming…">Confirm &amp; pay {formatMoney(quote.total)}</SubmitButton>
              </form>
            )}
          </div>

          {mode !== "pilot" && (
            <div className="card mt-4 space-y-3 border-2 border-amber-200 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-navy-800">Approved delivery network</h2>
                <span className="badge border-amber-200 bg-amber-50 text-amber-700">External · Not guaranteed yet</span>
              </div>
              <p className="text-xs text-navy-500">
                We&apos;ll authorize payment and send this to qualified independent delivery providers. You&apos;ll see
                &quot;awaiting provider acceptance&quot; until one accepts — <strong>this is not yet a guaranteed delivery.</strong> Only
                use this if Belliza crew isn&apos;t available above.
              </p>
              <form action={requestMarketplaceAction.bind(null, id)} className="space-y-3">
                <select className="input" name="windowDate" required defaultValue={bookableDays[0]?.date}>
                  {availability.map((d) => (
                    <option key={d.date} value={d.date}>
                      {formatDate(d.date)}
                    </option>
                  ))}
                </select>
                <select className="input" name="window" required>
                  {WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn-secondary w-full" pendingText="Sending…">
                  Send to delivery network
                </SubmitButton>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

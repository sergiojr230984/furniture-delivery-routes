import { requireRole } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { assertAssignmentOwnedByCrewUser } from "@/lib/crew-service";
import {
  advanceStatusAction,
  uploadPhotoAction,
  confirmChecklistAction,
  submitSignatureAction,
  waiveSignatureAction,
  reportIssueAction,
} from "./actions";
import SignatureCapture from "@/components/SignatureCapture";
import { signedFileUrls } from "@/lib/storage";
import type { AssignmentStatus } from "@/lib/constants";
import type { Booking, BookingDestination, BookingItem, BookingPickup } from "@/lib/types";

export default async function CrewJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: assignmentId } = await params;
  const { error } = await searchParams;
  const user = await requireRole("crew_member");
  await assertAssignmentOwnedByCrewUser(assignmentId, user.id);

  const assignment = await queryOne<{ id: string; booking_id: string; status: AssignmentStatus }>(
    `select id, booking_id, status from assignments where id = $1`,
    [assignmentId]
  );
  if (!assignment) throw new Error("Not found");

  const booking = await queryOne<Booking>(`select * from bookings where id = $1`, [assignment.booking_id]);
  const pickup = await queryOne<BookingPickup>(`select * from booking_pickups where booking_id = $1 order by sequence limit 1`, [assignment.booking_id]);
  const destination = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [assignment.booking_id]);
  const items = await query<BookingItem>(`select * from booking_items where booking_id = $1`, [assignment.booking_id]);
  const evidence = await query<{ id: string; stage: string; kind: string; file_path: string | null; meta: Record<string, unknown> }>(
    `select id, stage, kind, file_path, meta from job_evidence where assignment_id = $1 order by created_at`,
    [assignmentId]
  );

  const status = assignment.status;
  const navLink = (addr: string | null, city: string | null) =>
    addr ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${addr}, ${city ?? ""}`)}` : "#";

  const photoKeys = evidence.filter((e) => e.kind === "photo" && e.file_path).map((e) => e.file_path!);
  const photoUrls = await signedFileUrls(photoKeys);

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold text-navy-900">{booking?.booking_number}</h1>
        <p className="text-sm font-medium uppercase tracking-wide text-orange-600">{status.replace(/_/g, " ")}</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}

      {status === "assigned" && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold text-navy-800">Confirm crew &amp; vehicle</h2>
          <p className="text-sm text-navy-500">Confirm you have the assigned vehicle and both crew members before departing.</p>
          <form action={advanceStatusAction.bind(null, assignmentId, "en_route_pickup")}>
            <button type="submit" className="btn-primary w-full">
              Confirmed — start route
            </button>
          </form>
        </div>
      )}

      {status === "en_route_pickup" && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold text-navy-800">En route to pickup</h2>
          <p className="text-sm text-navy-600">{pickup?.address_line1}, {pickup?.city}</p>
          <a href={navLink(pickup?.address_line1 ?? null, pickup?.city ?? null)} target="_blank" className="btn-secondary w-full">
            Open navigation
          </a>
          <form action={advanceStatusAction.bind(null, assignmentId, "arrived_pickup")}>
            <button type="submit" className="btn-primary w-full">
              Arrived at pickup
            </button>
          </form>
        </div>
      )}

      {status === "arrived_pickup" && (
        <div className="card space-y-4 p-4">
          <h2 className="font-semibold text-navy-800">Pickup condition</h2>
          <EvidencePhotos evidence={evidence} stage="pickup_condition" urls={photoUrls} />
          <form action={uploadPhotoAction.bind(null, assignmentId, "pickup_condition")} className="space-y-2">
            <input type="file" name="file" accept="image/*" capture="environment" required className="input" />
            <input type="text" name="caption" placeholder="Note any existing damage (optional)" className="input" />
            <button type="submit" className="btn-secondary w-full">
              Add condition photo
            </button>
          </form>

          <h2 className="font-semibold text-navy-800">Collected items</h2>
          <form action={confirmChecklistAction.bind(null, assignmentId, "pickup_collected")} className="space-y-2">
            {items.map((it) => (
              <label key={it.id} className="flex items-center gap-2 text-sm text-navy-700">
                <input type="checkbox" name="items" value={it.id} /> {it.quantity}× {it.name}
              </label>
            ))}
            <button type="submit" className="btn-secondary w-full">
              Confirm collected checklist
            </button>
          </form>

          <form action={advanceStatusAction.bind(null, assignmentId, "picked_up")}>
            <button type="submit" className="btn-primary w-full">
              Items picked up
            </button>
          </form>
        </div>
      )}

      {status === "picked_up" && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold text-navy-800">Ready to deliver</h2>
          <form action={advanceStatusAction.bind(null, assignmentId, "en_route_delivery")}>
            <button type="submit" className="btn-primary w-full">
              En route to delivery
            </button>
          </form>
        </div>
      )}

      {status === "en_route_delivery" && (
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold text-navy-800">En route to delivery</h2>
          <p className="text-sm text-navy-600">{destination?.address_line1}, {destination?.city}</p>
          {destination?.instructions && <p className="text-xs text-navy-500">{destination.instructions}</p>}
          <a href={navLink(destination?.address_line1 ?? null, destination?.city ?? null)} target="_blank" className="btn-secondary w-full">
            Open navigation
          </a>
          <form action={advanceStatusAction.bind(null, assignmentId, "arrived_delivery")}>
            <button type="submit" className="btn-primary w-full">
              Arrived at delivery
            </button>
          </form>
        </div>
      )}

      {status === "arrived_delivery" && (
        <div className="card space-y-4 p-4">
          <h2 className="font-semibold text-navy-800">Delivered items</h2>
          <form action={confirmChecklistAction.bind(null, assignmentId, "delivery_items")} className="space-y-2">
            {items.map((it) => (
              <label key={it.id} className="flex items-center gap-2 text-sm text-navy-700">
                <input type="checkbox" name="items" value={it.id} /> {it.quantity}× {it.name}
              </label>
            ))}
            <button type="submit" className="btn-secondary w-full">
              Confirm delivered checklist
            </button>
          </form>

          {items.some((i) => i.assembly_required) && (
            <form action={confirmChecklistAction.bind(null, assignmentId, "assembly")} className="space-y-2 border-t border-navy-100 pt-3">
              <h2 className="font-semibold text-navy-800">Assembly</h2>
              {items.filter((i) => i.assembly_required).map((it) => (
                <label key={it.id} className="flex items-center gap-2 text-sm text-navy-700">
                  <input type="checkbox" name="items" value={it.id} /> {it.name} assembled
                </label>
              ))}
              <button type="submit" className="btn-secondary w-full">
                Confirm assembly complete
              </button>
            </form>
          )}

          <h2 className="font-semibold text-navy-800">Completion photos</h2>
          <EvidencePhotos evidence={evidence} stage="delivery_completed" urls={photoUrls} />
          <form action={uploadPhotoAction.bind(null, assignmentId, "delivery_completed")} className="space-y-2">
            <input type="file" name="file" accept="image/*" capture="environment" required className="input" />
            <button type="submit" className="btn-secondary w-full">
              Add completion photo
            </button>
          </form>

          <h2 className="font-semibold text-navy-800">Customer signature</h2>
          <SignatureCapture action={submitSignatureAction.bind(null, assignmentId)} />
          <form action={waiveSignatureAction.bind(null, assignmentId)} className="space-y-2 border-t border-navy-100 pt-3">
            <input type="text" name="reason" placeholder="Signature unavailable — reason" className="input" />
            <button type="submit" className="btn-ghost w-full text-xs">
              Waive signature (customer not present, etc.)
            </button>
          </form>

          <form action={advanceStatusAction.bind(null, assignmentId, "completed")}>
            <button type="submit" className="btn-primary w-full">
              Mark delivered
            </button>
          </form>
        </div>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-red-600">Report an issue / failed delivery</summary>
        <form action={reportIssueAction.bind(null, assignmentId)} className="mt-3 space-y-2">
          <textarea name="reason" required rows={3} placeholder="What happened?" className="input" />
          <button type="submit" className="btn-danger w-full">
            Report failed delivery
          </button>
        </form>
      </details>
    </div>
  );
}

function EvidencePhotos({
  evidence,
  stage,
  urls,
}: {
  evidence: { id: string; stage: string; kind: string; file_path: string | null }[];
  stage: string;
  urls: Record<string, string>;
}) {
  const photos = evidence.filter((e) => e.stage === stage && e.kind === "photo" && e.file_path);
  if (photos.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={urls[p.file_path!]} alt="" className="h-20 w-20 rounded-lg object-cover" />
      ))}
    </div>
  );
}

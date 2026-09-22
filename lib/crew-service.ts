// Crew mobile job workflow: a small linear state machine layered on top of
// `assignments`, with evidence requirements enforced server-side before a
// normal completion is accepted.
import { query, queryOne, withTransaction } from "./db";
import type { AssignmentStatus, BookingStatus } from "./constants";
import { assertTransition as assertBookingTransition } from "./state-machine";
import { createTrackingToken, trackingUrl } from "./tracking";
import { notifyOutForDelivery, notifyDeliveryCompleted, notifyException } from "./notify";

const ASSIGNMENT_FLOW: AssignmentStatus[] = [
  "assigned",
  "en_route_pickup",
  "arrived_pickup",
  "picked_up",
  "en_route_delivery",
  "arrived_delivery",
  "completed",
];

const ASSIGNMENT_TO_BOOKING_STATUS: Partial<Record<AssignmentStatus, BookingStatus>> = {
  en_route_pickup: "en_route_pickup",
  picked_up: "picked_up",
  en_route_delivery: "en_route_delivery",
  completed: "delivered",
  failed: "failed",
};

export class AssignmentTransitionError extends Error {}
export class MissingEvidenceError extends Error {}

function canAdvance(from: AssignmentStatus, to: AssignmentStatus): boolean {
  if (to === "failed" || to === "cancelled") return !["completed", "failed", "cancelled"].includes(from);
  const fromIdx = ASSIGNMENT_FLOW.indexOf(from);
  const toIdx = ASSIGNMENT_FLOW.indexOf(to);
  return fromIdx !== -1 && toIdx === fromIdx + 1;
}

export interface CrewAssignmentSummary {
  id: string;
  booking_id: string;
  booking_number: string;
  status: AssignmentStatus;
  window_date: string | null;
  window_start: string | null;
  window_end: string | null;
  customer_name: string | null;
  city: string | null;
}

export async function listAssignmentsForCrewUser(userId: string): Promise<CrewAssignmentSummary[]> {
  return query<CrewAssignmentSummary>(
    `select a.id, a.booking_id, b.booking_number, a.status, b.window_date, b.window_start, b.window_end,
            d.customer_name, d.city
     from assignments a
     join assignment_crew ac on ac.assignment_id = a.id
     join crew_members cm on cm.id = ac.crew_member_id
     join bookings b on b.id = a.booking_id
     left join booking_destination d on d.booking_id = b.id
     where cm.user_id = $1 and a.status not in ('completed','failed','cancelled')
     order by b.window_date nulls last, b.window_start nulls last`,
    [userId]
  );
}

export async function assertAssignmentOwnedByCrewUser(assignmentId: string, userId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `select a.id from assignments a
     join assignment_crew ac on ac.assignment_id = a.id
     join crew_members cm on cm.id = ac.crew_member_id
     where a.id = $1 and cm.user_id = $2`,
    [assignmentId, userId]
  );
  if (!row) throw new Error("Assignment not found");
}

async function evidenceCount(assignmentId: string, stage: string, kind: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*) from job_evidence where assignment_id = $1 and stage = $2 and kind = $3`,
    [assignmentId, stage, kind]
  );
  return parseInt(row?.count ?? "0", 10);
}

async function assertEvidenceForTransition(assignmentId: string, to: AssignmentStatus): Promise<void> {
  if (to === "picked_up") {
    const photos = await evidenceCount(assignmentId, "pickup_condition", "photo");
    const checklist = await evidenceCount(assignmentId, "pickup_collected", "checklist");
    if (photos === 0) throw new MissingEvidenceError("At least one pickup condition photo is required before marking items picked up.");
    if (checklist === 0) throw new MissingEvidenceError("Confirm the collected-items checklist before marking items picked up.");
  }
  if (to === "completed") {
    const photos = await evidenceCount(assignmentId, "delivery_completed", "photo");
    const signatures = await evidenceCount(assignmentId, "delivery_completed", "signature");
    const waivers = await evidenceCount(assignmentId, "delivery_completed", "signature_waived");
    if (photos === 0) throw new MissingEvidenceError("At least one completion photo is required before marking delivered.");
    if (signatures === 0 && waivers === 0) {
      throw new MissingEvidenceError("A customer signature (or an approved alternative) is required before marking delivered.");
    }
  }
}

export async function addJobEvidence(opts: {
  assignmentId: string;
  bookingId: string;
  stage: string;
  kind: string;
  filePath?: string | null;
  meta?: Record<string, unknown>;
  createdBy: string;
}): Promise<void> {
  await query(
    `insert into job_evidence (assignment_id, booking_id, stage, kind, file_path, meta, created_by)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [opts.assignmentId, opts.bookingId, opts.stage, opts.kind, opts.filePath ?? null, JSON.stringify(opts.meta ?? {}), opts.createdBy]
  );
}

export async function advanceAssignment(opts: {
  assignmentId: string;
  to: AssignmentStatus;
  actorUserId: string;
  notes?: string;
}): Promise<void> {
  const assignment = await queryOne<{ id: string; booking_id: string; status: AssignmentStatus }>(
    `select id, booking_id, status from assignments where id = $1`,
    [opts.assignmentId]
  );
  if (!assignment) throw new Error("Assignment not found");
  if (!canAdvance(assignment.status, opts.to)) {
    throw new AssignmentTransitionError(`Cannot move from ${assignment.status} to ${opts.to}`);
  }

  await assertEvidenceForTransition(opts.assignmentId, opts.to);

  const bookingStatus = ASSIGNMENT_TO_BOOKING_STATUS[opts.to];
  const booking = await queryOne<{ status: BookingStatus; retailer_org_id: string; booking_number: string }>(
    `select status, retailer_org_id, booking_number from bookings where id = $1`,
    [assignment.booking_id]
  );
  if (bookingStatus && booking) {
    assertBookingTransition(booking.status, bookingStatus);
  }

  await withTransaction(async (client) => {
    await client.query(`update assignments set status = $2 where id = $1`, [opts.assignmentId, opts.to]);
    if (bookingStatus) {
      await client.query(`update bookings set status = $2 where id = $1`, [assignment.booking_id, bookingStatus]);
      await client.query(
        `insert into status_events (booking_id, from_status, to_status, actor_user_id, notes) values ($1,$2,$3,$4,$5)`,
        [assignment.booking_id, booking?.status ?? null, bookingStatus, opts.actorUserId, opts.notes ?? null]
      );
    }
    if (opts.to === "completed") {
      // Payout only becomes eligible once the job is actually completed
      // with evidence on file — never before, and never automatically paid.
      await client.query(`update payouts set status = 'eligible' where assignment_id = $1 and status = 'pending'`, [opts.assignmentId]);
      await client.query(
        `update payments set status = 'captured' where booking_id = $1 and status = 'authorized'`,
        [assignment.booking_id]
      );
    }
    if (opts.to === "failed") {
      await client.query(`update payouts set status = 'held', held_reason = 'Delivery marked failed' where assignment_id = $1 and status = 'pending'`, [opts.assignmentId]);
    }
  });

  if (booking) {
    const dest = await queryOne<{ customer_phone: string | null }>(
      `select customer_phone from booking_destination where booking_id = $1`,
      [assignment.booking_id]
    );
    let token = await queryOne<{ token: string }>(
      `select token from tracking_tokens where booking_id = $1 order by created_at desc limit 1`,
      [assignment.booking_id]
    );
    if (!token) {
      const t = await createTrackingToken(assignment.booking_id);
      token = { token: t };
    }
    const url = trackingUrl(token.token);

    if (opts.to === "en_route_delivery") {
      await notifyOutForDelivery({ id: assignment.booking_id, retailerOrgId: booking.retailer_org_id, bookingNumber: booking.booking_number, customerPhone: dest?.customer_phone ?? null, trackingUrl: url });
    } else if (opts.to === "completed") {
      await notifyDeliveryCompleted({ id: assignment.booking_id, retailerOrgId: booking.retailer_org_id, bookingNumber: booking.booking_number, customerPhone: dest?.customer_phone ?? null, trackingUrl: url });
    } else if (opts.to === "failed") {
      await notifyException({ id: assignment.booking_id, retailerOrgId: booking.retailer_org_id, bookingNumber: booking.booking_number, customerPhone: dest?.customer_phone ?? null, reason: opts.notes || "delivery issue", trackingUrl: url });
    }
  }
}

export async function reportIssue(opts: { assignmentId: string; reason: string; actorUserId: string }): Promise<void> {
  await advanceAssignment({ assignmentId: opts.assignmentId, to: "failed", actorUserId: opts.actorUserId, notes: opts.reason });
}

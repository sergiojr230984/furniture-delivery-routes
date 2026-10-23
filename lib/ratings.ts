// Provider ratings: the retailer who booked a delivery rates it (1-5
// stars + optional comment) once the job is in a terminal state. This is
// the core trust signal in a two-sided marketplace — every comparable
// platform researched treats it as table stakes, and this app had none.
import { query, queryOne } from "./db";

export class AlreadyRatedError extends Error {
  constructor() {
    super("This delivery has already been rated.");
  }
}

export class NotRatableYetError extends Error {
  constructor() {
    super("This delivery can't be rated until it's completed or marked failed.");
  }
}

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "23505";
}

export async function rateDelivery(opts: {
  bookingId: string;
  retailerOrgId: string;
  rating: number;
  comment: string | null;
  ratedBy: string;
}): Promise<void> {
  if (!Number.isInteger(opts.rating) || opts.rating < 1 || opts.rating > 5) {
    throw new Error("Rating must be a whole number between 1 and 5");
  }

  // Scoping the lookup by retailerOrgId doubles as the ownership check —
  // a retailer can only rate deliveries on their own bookings.
  const assignment = await queryOne<{ id: string; provider_org_id: string; status: string }>(
    `select a.id, a.provider_org_id, a.status
     from assignments a join bookings b on b.id = a.booking_id
     where a.booking_id = $1 and b.retailer_org_id = $2`,
    [opts.bookingId, opts.retailerOrgId]
  );
  if (!assignment) throw new Error("No assignment found for this booking");
  if (!["completed", "failed"].includes(assignment.status)) throw new NotRatableYetError();

  try {
    await query(
      `insert into assignment_ratings (assignment_id, booking_id, provider_org_id, rating, comment, rated_by)
       values ($1,$2,$3,$4,$5,$6)`,
      [assignment.id, opts.bookingId, assignment.provider_org_id, opts.rating, opts.comment, opts.ratedBy]
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new AlreadyRatedError();
    throw err;
  }
}

export interface RatingSummary {
  avg: number | null;
  count: number;
}

export async function getProviderRatingSummary(providerOrgId: string): Promise<RatingSummary> {
  const row = await queryOne<{ avg: string | null; count: string }>(
    `select avg(rating)::numeric(3,2) as avg, count(*) as count from assignment_ratings where provider_org_id = $1`,
    [providerOrgId]
  );
  return { avg: row?.avg != null ? parseFloat(row.avg) : null, count: parseInt(row?.count ?? "0", 10) };
}

export async function getProviderRatingSummaries(providerOrgIds: string[]): Promise<Map<string, RatingSummary>> {
  if (providerOrgIds.length === 0) return new Map();
  const rows = await query<{ provider_org_id: string; avg: string | null; count: string }>(
    `select provider_org_id, avg(rating)::numeric(3,2) as avg, count(*) as count
     from assignment_ratings where provider_org_id = any($1::uuid[]) group by provider_org_id`,
    [providerOrgIds]
  );
  const map = new Map<string, RatingSummary>();
  for (const r of rows) {
    map.set(r.provider_org_id, { avg: r.avg != null ? parseFloat(r.avg) : null, count: parseInt(r.count, 10) });
  }
  return map;
}

export interface RatingWithContext {
  rating: number;
  comment: string | null;
  booking_number: string;
  created_at: string;
}

export async function listProviderRatings(providerOrgId: string, limit = 20): Promise<RatingWithContext[]> {
  return query<RatingWithContext>(
    `select r.rating, r.comment, b.booking_number, r.created_at
     from assignment_ratings r join bookings b on b.id = r.booking_id
     where r.provider_org_id = $1
     order by r.created_at desc limit $2`,
    [providerOrgId, limit]
  );
}

export async function getBookingRating(bookingId: string): Promise<{ rating: number; comment: string | null } | null> {
  return queryOne<{ rating: number; comment: string | null }>(
    `select rating, comment from assignment_ratings where booking_id = $1`,
    [bookingId]
  );
}

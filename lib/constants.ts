// Shared enums, labels and colour mappings used across the app.
// Keep in sync with the Postgres enum types in db/migrations.

export const ORG_TYPES = ["platform", "retailer", "provider"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ROLES = [
  "platform_admin",
  "dispatcher",
  "retailer_owner",
  "retailer_staff",
  "provider_owner",
  "crew_member",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  dispatcher: "Dispatcher",
  retailer_owner: "Retailer Owner",
  retailer_staff: "Retailer Salesperson",
  provider_owner: "Delivery Provider Owner",
  crew_member: "Crew Member",
};

// Which "app area" each role lands in.
export const ROLE_AREA: Record<Role, "admin" | "retailer" | "provider" | "crew"> = {
  platform_admin: "admin",
  dispatcher: "admin",
  retailer_owner: "retailer",
  retailer_staff: "retailer",
  provider_owner: "provider",
  crew_member: "crew",
};

export const APP_MODES = ["demo", "pilot", "marketplace"] as const;
export type AppMode = (typeof APP_MODES)[number];

export function currentAppMode(): AppMode {
  const m = process.env.APP_MODE as AppMode | undefined;
  return m && APP_MODES.includes(m) ? m : "demo";
}

// ---- Bookings -----------------------------------------------------------

export const BOOKING_STATUSES = [
  "draft",
  "quote_ready",
  "awaiting_acceptance", // marketplace: awaiting a qualified provider to accept
  "confirmed", // capacity secured (internal hold or provider acceptance + payment authorized)
  "en_route_pickup",
  "picked_up",
  "en_route_delivery",
  "delivered",
  "partially_delivered",
  "failed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  quote_ready: "Quote ready",
  awaiting_acceptance: "Awaiting provider acceptance",
  confirmed: "Confirmed",
  en_route_pickup: "En route to pickup",
  picked_up: "Picked up",
  en_route_delivery: "Out for delivery",
  delivered: "Delivered",
  partially_delivered: "Partially delivered",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  quote_ready: "bg-sky-100 text-sky-700 border-sky-200",
  awaiting_acceptance: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-navy-100 text-navy-800 border-navy-200",
  en_route_pickup: "bg-orange-100 text-orange-800 border-orange-200",
  picked_up: "bg-orange-100 text-orange-800 border-orange-200",
  en_route_delivery: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  partially_delivered: "bg-yellow-100 text-yellow-800 border-yellow-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

// Legal forward transitions for the booking state machine (server-enforced).
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["quote_ready", "cancelled"],
  quote_ready: ["awaiting_acceptance", "confirmed", "cancelled"],
  awaiting_acceptance: ["confirmed", "cancelled", "failed"],
  confirmed: ["en_route_pickup", "cancelled", "failed"],
  en_route_pickup: ["picked_up", "failed", "cancelled"],
  picked_up: ["en_route_delivery", "failed"],
  en_route_delivery: ["delivered", "partially_delivered", "failed"],
  delivered: [],
  partially_delivered: [],
  failed: [],
  cancelled: [],
};

export const SERVICE_LEVELS = ["curbside", "room_of_choice", "room_of_choice_assembly"] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

export const SERVICE_LEVEL_LABELS: Record<ServiceLevel, string> = {
  curbside: "Curbside",
  room_of_choice: "Room of Choice",
  room_of_choice_assembly: "Room of Choice + Assembly",
};

export const SERVICE_LEVEL_DESCRIPTIONS: Record<ServiceLevel, string> = {
  curbside:
    "Crew brings items to the curb or building entrance only. Customer handles moving items indoors.",
  room_of_choice:
    "Crew carries items into the home and places them in the room you choose. Packaging removed on request. No assembly.",
  room_of_choice_assembly:
    "Everything in Room of Choice, plus full assembly of the item(s) (legs, headboards, tabletops, etc.) and packaging removed.",
};

export const PICKUP_TYPES = ["store", "address", "warehouse"] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];

export const ITEM_CATEGORIES = [
  "sofa",
  "sectional",
  "bed_frame",
  "mattress",
  "dining_set",
  "mirror",
  "tv_stand",
  "dresser",
  "table",
  "chair",
  "misc",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  sofa: "Sofa / Loveseat",
  sectional: "Sectional",
  bed_frame: "Bed Frame",
  mattress: "Mattress / Box Spring",
  dining_set: "Dining Set",
  mirror: "Mirror",
  tv_stand: "TV Stand",
  dresser: "Dresser",
  table: "Table",
  chair: "Chair",
  misc: "Miscellaneous Furniture",
};

export const PACKAGING_CONDITIONS = ["original_box", "wrapped", "unwrapped", "unknown"] as const;
export type PackagingCondition = (typeof PACKAGING_CONDITIONS)[number];

// ---- Offers / assignments / providers -----------------------------------

export const OFFER_STATUSES = ["pending", "accepted", "declined", "expired", "cancelled"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const PROVIDER_STATUSES = ["pending_review", "approved", "suspended", "rejected"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const DOCUMENT_STATUSES = ["pending_review", "approved", "rejected", "expired"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "en_route_pickup",
  "arrived_pickup",
  "picked_up",
  "en_route_delivery",
  "arrived_delivery",
  "completed",
  "failed",
  "cancelled",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const CREW_JOB_STEPS = [
  "assigned",
  "en_route_pickup",
  "arrived_pickup",
  "picked_up",
  "en_route_delivery",
  "arrived_delivery",
  "completed",
] as const;

// ---- Payments / ledger ---------------------------------------------------

export const PAYMENT_STATUSES = [
  "not_required",
  "authorized",
  "captured",
  "refunded",
  "failed",
  "demo_recorded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const LEDGER_ENTRY_TYPES = [
  "retailer_charge",
  "retailer_refund",
  "provider_payout",
  "provider_adjustment",
  "processing_fee",
  "internal_delivery_cost",
  "claims_allowance",
  "claims_payout",
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const PAYOUT_STATUSES = ["pending", "eligible", "paid", "held", "demo_recorded"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

// ---- Claims ---------------------------------------------------------------

export const CLAIM_STATUSES = ["open", "under_review", "approved", "denied", "resolved"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ---- Warehouse collection (retailer's own driver, separate from bookings) -

export const WAREHOUSE_COLLECTION_STATUSES = [
  "scheduled",
  "checked_in",
  "collected",
  "no_show",
  "cancelled",
] as const;
export type WarehouseCollectionStatus = (typeof WAREHOUSE_COLLECTION_STATUSES)[number];

// ---- Units / locale --------------------------------------------------------

export const TIME_ZONE = "America/New_York";
export const CURRENCY = "USD";
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export function homePathForRole(role: Role): string {
  switch (ROLE_AREA[role]) {
    case "admin":
      return "/admin/dashboard";
    case "retailer":
      return "/retailer/dashboard";
    case "provider":
      return "/provider/dashboard";
    case "crew":
      return "/crew/jobs";
  }
}

export function isStaffRole(role: Role) {
  return role === "platform_admin" || role === "dispatcher";
}
export function isRetailerRole(role: Role) {
  return role === "retailer_owner" || role === "retailer_staff";
}
export function isProviderRole(role: Role) {
  return role === "provider_owner" || role === "crew_member";
}

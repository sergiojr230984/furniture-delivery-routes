// Hand-written row types for the tables the app reads/writes.
import type {
  OrgType,
  Role,
  BookingStatus,
  ServiceLevel,
  PickupType,
  ItemCategory,
  PackagingCondition,
  OfferStatus,
  AssignmentStatus,
  PaymentStatus,
  PayoutStatus,
  LedgerEntryType,
  ClaimStatus,
  DocumentStatus,
  WarehouseCollectionStatus,
} from "./constants";

export interface Organization {
  id: string;
  type: OrgType;
  name: string;
  is_internal_fleet: boolean;
  is_demo: boolean;
  status: "active" | "pending_review" | "suspended" | "rejected";
  locale_default: string;
  contact_email: string | null;
  contact_phone: string | null;
  service_area_notes: string | null;
  contribution_floor_amount: string | null;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  locale: string;
  active: boolean;
  created_at: string;
}

export interface RetailerLocation {
  id: string;
  org_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  active: boolean;
}

export interface BellizaWarehouse {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
}

export interface SavedProduct {
  id: string;
  org_id: string;
  name: string;
  category: ItemCategory;
  length_in: string | null;
  width_in: string | null;
  height_in: string | null;
  weight_lbs: string | null;
  default_assembly_required: boolean;
  photo_path: string | null;
}

export interface ProviderVehicle {
  id: string;
  org_id: string;
  name: string;
  vehicle_type: string;
  cargo_length_in: string | null;
  cargo_width_in: string | null;
  cargo_height_in: string | null;
  door_width_in: string | null;
  payload_lbs: string;
  max_jobs_per_day: number;
  status: string;
  license_plate: string | null;
  notes: string | null;
}

export interface CrewMember {
  id: string;
  org_id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  can_assemble: boolean;
  active: boolean;
}

export interface ProviderDocument {
  id: string;
  org_id: string;
  doc_type: string;
  file_path: string;
  issued_at: string | null;
  expires_at: string | null;
  status: DocumentStatus;
  review_notes: string | null;
  created_at: string;
}

export interface PricingRuleSet {
  id: string;
  version: number;
  label: string;
  status: "draft" | "active" | "archived";
  config: PricingConfig;
  created_at: string;
  activated_at: string | null;
}

export interface PricingConfig {
  currency: string;
  minimum_charge: number;
  base_miles_included: number;
  per_mile_rate: number;
  category_rates: Partial<Record<ItemCategory, number>>;
  per_extra_item_rate: number;
  two_person_crew_fee: number;
  stairs_fee_per_flight: number;
  assembly_fee_per_item: number;
  priority_fee: number;
  dedicated_service_fee: number;
  waiting_rate_per_15min: number;
  extra_stop_fee: number;
  failed_delivery_fee: number;
  debris_removal_fee: number;
  old_furniture_removal_fee: number;
  service_level_multipliers: Record<ServiceLevel, number>;
  provider_payout_percent: number; // % of retailer price paid to provider before adjustments
  processing_fee_percent: number; // card processing estimate
  variable_support_claims_percent: number; // estimated variable support/claims cost, for contribution
  retailer_discounts: Record<string, number>; // retailer_org_id -> percent off
}

export interface Booking {
  id: string;
  booking_number: string;
  retailer_org_id: string;
  retailer_location_id: string | null;
  created_by: string | null;
  status: BookingStatus;
  mode: "internal" | "marketplace";
  service_level: ServiceLevel;
  priority: boolean;
  debris_removal: boolean;
  old_furniture_removal: boolean;
  window_date: string | null;
  window_start: string | null;
  window_end: string | null;
  pricing_rule_set_id: string | null;
  quote: QuoteBreakdown | null;
  price_total: string | null;
  currency: string;
  cancellation_terms: string | null;
  internal_notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteBreakdown {
  currency: string;
  lineItems: { label: string; amount: number }[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  providerPayout: number;
  processingFeeEstimate: number;
  needsReview: boolean;
  reviewReasons: string[];
  ruleSetVersion: number;
}

export interface BookingPickup {
  id: string;
  booking_id: string;
  sequence: number;
  pickup_type: PickupType;
  location_id: string | null;
  warehouse_id: string | null;
  warehouse_order_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  floor: number | null;
  stairs_flights: number;
  elevator_available: boolean;
  parking_notes: string | null;
  instructions: string | null;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  saved_product_id: string | null;
  name: string;
  category: ItemCategory;
  quantity: number;
  length_in: string | null;
  width_in: string | null;
  height_in: string | null;
  weight_lbs: string | null;
  dims_unknown: boolean;
  photos: string[];
  declared_value: string | null;
  packaging_condition: PackagingCondition;
  assembly_required: boolean;
  needs_review: boolean;
  review_reason: string | null;
}

export interface BookingDestination {
  booking_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  floor: number | null;
  stairs_flights: number;
  elevator_available: boolean;
  elevator_reserved: boolean;
  building_hours: string | null;
  parking_notes: string | null;
  walking_distance_ft: number | null;
  instructions: string | null;
  access_completed: boolean;
  access_token: string | null;
  access_token_expires_at: string | null;
}

export interface Offer {
  id: string;
  booking_id: string;
  provider_org_id: string;
  payout_amount: string;
  scope: Record<string, unknown>;
  status: OfferStatus;
  expires_at: string;
  created_at: string;
  responded_at: string | null;
}

export interface Assignment {
  id: string;
  booking_id: string;
  provider_org_id: string;
  vehicle_id: string | null;
  route_id: string | null;
  status: AssignmentStatus;
  offer_id: string | null;
  override_reason: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  provider: string;
  stripe_payment_intent_id: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  is_demo: boolean;
  failure_reason: string | null;
}

export interface Payout {
  id: string;
  assignment_id: string;
  provider_org_id: string;
  amount: string;
  status: PayoutStatus;
  is_demo: boolean;
  held_reason: string | null;
  paid_at: string | null;
}

export interface LedgerEntry {
  id: string;
  entry_type: LedgerEntryType;
  booking_id: string | null;
  org_id: string | null;
  amount: string;
  currency: string;
  is_demo: boolean;
  notes: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  booking_id: string;
  status: ClaimStatus;
  description: string;
  requested_amount: string | null;
  decision_notes: string | null;
  adjustment_amount: string | null;
  created_at: string;
}

export interface WarehouseCollectionAppointment {
  id: string;
  retailer_org_id: string;
  order_number: string;
  scheduled_at: string;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_plate: string | null;
  status: WarehouseCollectionStatus;
  notes: string | null;
}

// Pricing engine — pure functions, unit-tested in tests/pricing.test.ts.
//
// Retailer price and provider payout are always computed separately: the
// retailer never sees the payout math, and the payout is a percentage of
// the *retailer* price (configurable), not a separately negotiated number.
// Every quote captures the rule-set version it used so historical bookings
// are unaffected by later rate changes.
import type { ItemCategory, ServiceLevel } from "./constants";
import type { PricingConfig, QuoteBreakdown } from "./types";

export const EXAMPLE_PRICING_CONFIG: PricingConfig = {
  currency: "USD",
  minimum_charge: 89,
  base_miles_included: 10,
  per_mile_rate: 2.25,
  category_rates: {
    sofa: 45,
    sectional: 85,
    bed_frame: 40,
    mattress: 30,
    dining_set: 65,
    mirror: 20,
    tv_stand: 25,
    dresser: 35,
    table: 30,
    chair: 12,
    misc: 20,
  },
  per_extra_item_rate: 8,
  two_person_crew_fee: 35,
  stairs_fee_per_flight: 15,
  assembly_fee_per_item: 40,
  priority_fee: 45,
  dedicated_service_fee: 75,
  waiting_rate_per_15min: 12,
  extra_stop_fee: 25,
  failed_delivery_fee: 50,
  debris_removal_fee: 30,
  old_furniture_removal_fee: 55,
  service_level_multipliers: {
    curbside: 1,
    room_of_choice: 1.15,
    room_of_choice_assembly: 1.3,
  },
  provider_payout_percent: 70,
  processing_fee_percent: 2.9,
  variable_support_claims_percent: 3,
  retailer_discounts: {},
};

export interface QuoteItemInput {
  category: ItemCategory;
  quantity: number;
  weightLbs: number | null;
  dimsUnknown: boolean;
  assemblyRequired: boolean;
}

export interface QuoteInput {
  items: QuoteItemInput[];
  distanceMiles: number;
  serviceLevel: ServiceLevel;
  stairsFlightsTotal: number;
  priority: boolean;
  debrisRemoval: boolean;
  oldFurnitureRemoval: boolean;
  extraStopsCount: number; // pickups/destinations beyond the first pair
  retailerOrgId: string;
}

const HEAVY_ITEM_LBS = 300;

export function computeQuote(input: QuoteInput, config: PricingConfig, ruleSetVersion: number): QuoteBreakdown {
  const lineItems: { label: string; amount: number }[] = [];
  const reviewReasons: string[] = [];

  let totalQty = 0;
  let categorySubtotal = 0;
  let assemblyItemCount = 0;

  for (const item of input.items) {
    totalQty += item.quantity;
    const rate = config.category_rates[item.category] ?? config.category_rates.misc ?? 20;
    categorySubtotal += rate * item.quantity;
    if (item.assemblyRequired) assemblyItemCount += item.quantity;

    if (item.dimsUnknown) {
      reviewReasons.push(`Dimensions unknown for a ${item.category.replace("_", " ")} — needs manual review before final confirmation.`);
    }
    if (item.weightLbs != null && item.weightLbs > HEAVY_ITEM_LBS) {
      reviewReasons.push(`A ${item.category.replace("_", " ")} is listed at ${item.weightLbs} lbs, above the ${HEAVY_ITEM_LBS} lb conservative threshold — needs manual review.`);
    }
  }

  if (input.items.some((i) => i.assemblyRequired) && input.serviceLevel !== "room_of_choice_assembly") {
    reviewReasons.push("Item(s) marked as requiring assembly, but the selected service level does not include assembly.");
  }

  lineItems.push({ label: "Item handling", amount: round2(categorySubtotal) });

  const extraItems = Math.max(0, totalQty - 1);
  if (extraItems > 0) {
    lineItems.push({ label: `Additional items (${extraItems})`, amount: round2(extraItems * config.per_extra_item_rate) });
  }

  const billableMiles = Math.max(0, input.distanceMiles - config.base_miles_included);
  if (billableMiles > 0) {
    lineItems.push({ label: `Distance (${round1(billableMiles)} mi beyond ${config.base_miles_included} mi included)`, amount: round2(billableMiles * config.per_mile_rate) });
  }

  lineItems.push({ label: "Two-person crew", amount: config.two_person_crew_fee });

  if (input.stairsFlightsTotal > 0) {
    lineItems.push({ label: `Stairs (${input.stairsFlightsTotal} flight${input.stairsFlightsTotal === 1 ? "" : "s"})`, amount: round2(input.stairsFlightsTotal * config.stairs_fee_per_flight) });
  }

  if (input.serviceLevel === "room_of_choice_assembly" && assemblyItemCount > 0) {
    lineItems.push({ label: `Assembly (${assemblyItemCount} item${assemblyItemCount === 1 ? "" : "s"})`, amount: round2(assemblyItemCount * config.assembly_fee_per_item) });
  }

  if (input.priority) {
    lineItems.push({ label: "Priority / dedicated window", amount: config.dedicated_service_fee });
  }

  if (input.extraStopsCount > 0) {
    lineItems.push({ label: `Extra stops (${input.extraStopsCount})`, amount: round2(input.extraStopsCount * config.extra_stop_fee) });
  }

  if (input.debrisRemoval) {
    lineItems.push({ label: "Debris removal", amount: config.debris_removal_fee });
  }
  if (input.oldFurnitureRemoval) {
    lineItems.push({ label: "Old furniture removal", amount: config.old_furniture_removal_fee });
  }

  let subtotal = lineItems.reduce((s, l) => s + l.amount, 0);

  const multiplier = config.service_level_multipliers[input.serviceLevel] ?? 1;
  if (multiplier !== 1) {
    const adjustment = subtotal * (multiplier - 1);
    lineItems.push({ label: "Service level adjustment", amount: round2(adjustment) });
    subtotal += adjustment;
  }

  const flooredSubtotal = Math.max(subtotal, config.minimum_charge);
  if (flooredSubtotal > subtotal) {
    lineItems.push({ label: "Minimum charge adjustment", amount: round2(flooredSubtotal - subtotal) });
  }
  subtotal = flooredSubtotal;

  const discountPercent = config.retailer_discounts[input.retailerOrgId] ?? 0;
  const discountAmount = round2(subtotal * (discountPercent / 100));
  const total = round2(subtotal - discountAmount);

  const providerPayout = round2(total * (config.provider_payout_percent / 100));
  const processingFeeEstimate = round2(total * (config.processing_fee_percent / 100));

  return {
    currency: config.currency,
    lineItems: lineItems.map((l) => ({ ...l, amount: round2(l.amount) })),
    subtotal: round2(subtotal),
    discountPercent,
    discountAmount,
    total,
    providerPayout,
    processingFeeEstimate,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    ruleSetVersion,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

import { describe, it, expect } from "vitest";
import { computeQuote, EXAMPLE_PRICING_CONFIG } from "../lib/pricing";
import type { QuoteInput } from "../lib/pricing";

function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    items: [{ category: "sofa", quantity: 1, weightLbs: 120, dimsUnknown: false, assemblyRequired: false }],
    distanceMiles: 5,
    serviceLevel: "curbside",
    stairsFlightsTotal: 0,
    priority: false,
    debrisRemoval: false,
    oldFurnitureRemoval: false,
    extraStopsCount: 0,
    retailerOrgId: "retailer-1",
    ...overrides,
  };
}

describe("computeQuote", () => {
  it("enforces the minimum charge", () => {
    const quote = computeQuote(
      baseInput({ items: [{ category: "chair", quantity: 1, weightLbs: 10, dimsUnknown: false, assemblyRequired: false }] }),
      EXAMPLE_PRICING_CONFIG,
      1
    );
    expect(quote.total).toBeGreaterThanOrEqual(EXAMPLE_PRICING_CONFIG.minimum_charge);
  });

  it("only bills distance beyond the included miles", () => {
    const short = computeQuote(baseInput({ distanceMiles: 5 }), EXAMPLE_PRICING_CONFIG, 1);
    const long = computeQuote(baseInput({ distanceMiles: 30 }), EXAMPLE_PRICING_CONFIG, 1);
    expect(long.total).toBeGreaterThan(short.total);
    const distanceLine = short.lineItems.find((l) => l.label.startsWith("Distance"));
    expect(distanceLine).toBeUndefined(); // 5mi is within the 10mi included allowance
  });

  it("applies the service level multiplier", () => {
    const curbside = computeQuote(baseInput({ serviceLevel: "curbside" }), EXAMPLE_PRICING_CONFIG, 1);
    const roomOfChoice = computeQuote(baseInput({ serviceLevel: "room_of_choice" }), EXAMPLE_PRICING_CONFIG, 1);
    expect(roomOfChoice.total).toBeGreaterThan(curbside.total);
  });

  it("charges assembly only when the service level includes it, and flags a mismatch", () => {
    const mismatched = computeQuote(
      baseInput({
        serviceLevel: "curbside",
        items: [{ category: "bed_frame", quantity: 1, weightLbs: 100, dimsUnknown: false, assemblyRequired: true }],
      }),
      EXAMPLE_PRICING_CONFIG,
      1
    );
    expect(mismatched.lineItems.some((l) => l.label.startsWith("Assembly"))).toBe(false);
    expect(mismatched.needsReview).toBe(true);

    const matched = computeQuote(
      baseInput({
        serviceLevel: "room_of_choice_assembly",
        items: [{ category: "bed_frame", quantity: 1, weightLbs: 100, dimsUnknown: false, assemblyRequired: true }],
      }),
      EXAMPLE_PRICING_CONFIG,
      1
    );
    expect(matched.lineItems.some((l) => l.label.startsWith("Assembly"))).toBe(true);
  });

  it("flags unknown dimensions and heavy items for manual review", () => {
    const unknown = computeQuote(
      baseInput({ items: [{ category: "sofa", quantity: 1, weightLbs: null, dimsUnknown: true, assemblyRequired: false }] }),
      EXAMPLE_PRICING_CONFIG,
      1
    );
    expect(unknown.needsReview).toBe(true);

    const heavy = computeQuote(
      baseInput({ items: [{ category: "sectional", quantity: 1, weightLbs: 350, dimsUnknown: false, assemblyRequired: false }] }),
      EXAMPLE_PRICING_CONFIG,
      1
    );
    expect(heavy.needsReview).toBe(true);
  });

  it("applies a per-retailer discount", () => {
    const config = { ...EXAMPLE_PRICING_CONFIG, retailer_discounts: { "retailer-1": 10 } };
    const quote = computeQuote(baseInput(), config, 1);
    expect(quote.discountPercent).toBe(10);
    expect(quote.discountAmount).toBeGreaterThan(0);
    expect(quote.total).toBeCloseTo(quote.subtotal - quote.discountAmount, 2);
  });

  it("computes provider payout and processing fee as a percentage of the final total, never the subtotal", () => {
    const config = { ...EXAMPLE_PRICING_CONFIG, retailer_discounts: { "retailer-1": 50 }, provider_payout_percent: 70 };
    const quote = computeQuote(baseInput(), config, 1);
    expect(quote.providerPayout).toBeCloseTo(quote.total * 0.7, 2);
  });

  it("records the rule-set version on every quote", () => {
    const quote = computeQuote(baseInput(), EXAMPLE_PRICING_CONFIG, 7);
    expect(quote.ruleSetVersion).toBe(7);
  });
});

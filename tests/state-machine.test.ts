import { describe, it, expect } from "vitest";
import { canTransition, assertTransition, InvalidTransitionError } from "../lib/state-machine";
import { BOOKING_STATUSES } from "../lib/constants";

describe("booking state machine", () => {
  it("allows the documented forward transitions", () => {
    expect(canTransition("draft", "quote_ready")).toBe(true);
    expect(canTransition("quote_ready", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "en_route_pickup")).toBe(true);
    expect(canTransition("en_route_delivery", "delivered")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransition("draft", "confirmed")).toBe(false);
    expect(canTransition("confirmed", "delivered")).toBe(false);
  });

  it("rejects transitions out of terminal states", () => {
    for (const terminal of ["delivered", "failed", "cancelled", "partially_delivered"] as const) {
      for (const target of BOOKING_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const status of BOOKING_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("assertTransition throws a typed error on an illegal move", () => {
    expect(() => assertTransition("draft", "delivered")).toThrow(InvalidTransitionError);
  });
});

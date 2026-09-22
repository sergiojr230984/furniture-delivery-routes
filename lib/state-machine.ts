// Server-enforced booking state machine. Never trust a client-sent target
// status without checking this table first.
import { BOOKING_TRANSITIONS, type BookingStatus } from "./constants";

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Cannot transition booking from "${from}" to "${to}"`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

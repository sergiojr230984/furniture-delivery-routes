import { describe, it, expect } from "vitest";
import { assessVehicleFit } from "../lib/capacity";

const van = { doorWidthIn: 50, cargoLengthIn: 110, payloadLbs: 3000 };

describe("assessVehicleFit", () => {
  it("marks a normal load as likely to fit", () => {
    const result = assessVehicleFit(
      [{ lengthIn: 40, widthIn: 30, heightIn: 30, dimsUnknown: false, weightLbs: 150 }],
      van
    );
    expect(result.fits).toBe("likely");
    expect(result.reasons).toHaveLength(0);
  });

  it("flags unknown dimensions for review rather than guessing", () => {
    const result = assessVehicleFit(
      [{ lengthIn: null, widthIn: null, heightIn: null, dimsUnknown: true, weightLbs: null }],
      van
    );
    expect(result.fits).toBe("needs_review");
  });

  it("flags an item whose smallest dimension exceeds the door opening as unlikely", () => {
    const result = assessVehicleFit(
      [{ lengthIn: 100, widthIn: 60, heightIn: 60, dimsUnknown: false, weightLbs: 200 }],
      van
    );
    expect(result.fits).toBe("unlikely");
    expect(result.reasons.some((r) => r.includes("door opening"))).toBe(true);
  });

  it("flags total weight exceeding payload even if each item is individually fine", () => {
    const result = assessVehicleFit(
      [
        { lengthIn: 30, widthIn: 20, heightIn: 20, dimsUnknown: false, weightLbs: 1600 },
        { lengthIn: 30, widthIn: 20, heightIn: 20, dimsUnknown: false, weightLbs: 1600 },
      ],
      van
    );
    expect(result.fits).toBe("unlikely");
    expect(result.reasons.some((r) => r.includes("payload"))).toBe(true);
  });

  it("does not claim volume alone guarantees a fit — only checks the smallest opening", () => {
    // Two small items whose combined volume would exceed a naive cubic check
    // for a tiny vehicle, but each individually clears the door opening.
    const tinyDoorVan = { doorWidthIn: 24, cargoLengthIn: 200, payloadLbs: 5000 };
    const result = assessVehicleFit(
      [
        { lengthIn: 20, widthIn: 20, heightIn: 20, dimsUnknown: false, weightLbs: 50 },
        { lengthIn: 20, widthIn: 20, heightIn: 20, dimsUnknown: false, weightLbs: 50 },
      ],
      tinyDoorVan
    );
    expect(result.fits).toBe("likely");
  });
});

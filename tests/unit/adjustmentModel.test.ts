import { describe, it, expect } from "vitest";
import { calcMagnitudeCm, getSeverity, JOINT_ADJUSTMENTS } from "../../engine/adjustmentModel";

// ─── calcMagnitudeCm ────────────────────────────────────────────────────────

describe("calcMagnitudeCm — none", () => {
  it("returns 0 for adjustment type 'none'", () => {
    expect(calcMagnitudeCm(10, "none")).toBe(0);
  });

  it("returns 0 for 'none' regardless of delta", () => {
    expect(calcMagnitudeCm(0, "none")).toBe(0);
    expect(calcMagnitudeCm(100, "none")).toBe(0);
  });
});

describe("calcMagnitudeCm — saddle_height (4 °/cm)", () => {
  it("4° → 1.0 cm", () => {
    expect(calcMagnitudeCm(4, "saddle_height")).toBe(1.0);
  });

  it("6° → 1.5 cm", () => {
    expect(calcMagnitudeCm(6, "saddle_height")).toBe(1.5);
  });

  it("8° → 2.0 cm", () => {
    expect(calcMagnitudeCm(8, "saddle_height")).toBe(2.0);
  });

  it("2° → 0.5 cm (minimum increment)", () => {
    expect(calcMagnitudeCm(2, "saddle_height")).toBe(0.5);
  });

  it("negative delta uses absolute value", () => {
    expect(calcMagnitudeCm(-6, "saddle_height")).toBe(1.5);
  });
});

describe("calcMagnitudeCm — handlebar_height (3 °/cm)", () => {
  it("3° → 1.0 cm", () => {
    expect(calcMagnitudeCm(3, "handlebar_height")).toBe(1.0);
  });

  it("6° → 2.0 cm", () => {
    expect(calcMagnitudeCm(6, "handlebar_height")).toBe(2.0);
  });

  it("9° → 3.0 cm", () => {
    expect(calcMagnitudeCm(9, "handlebar_height")).toBe(3.0);
  });

  it("negative delta uses absolute value", () => {
    expect(calcMagnitudeCm(-9, "handlebar_height")).toBe(3.0);
  });
});

describe("calcMagnitudeCm — stem_length (4 °/cm, same as saddle)", () => {
  it("4° → 1.0 cm", () => {
    expect(calcMagnitudeCm(4, "stem_length")).toBe(1.0);
  });

  it("6° → 1.5 cm", () => {
    expect(calcMagnitudeCm(6, "stem_length")).toBe(1.5);
  });
});

describe("calcMagnitudeCm — rounding to nearest 0.5", () => {
  it("1° with saddle_height → rounds to 0.5 (not 0.25)", () => {
    // 1/4 = 0.25 → Math.round(0.25*2)/2 = Math.round(0.5)/2 = 1/2 = 0.5
    expect(calcMagnitudeCm(1, "saddle_height")).toBe(0.5);
  });

  it("result is always a multiple of 0.5", () => {
    for (let d = 1; d <= 20; d++) {
      const result = calcMagnitudeCm(d, "saddle_height");
      expect(result % 0.5).toBe(0);
    }
  });
});

// ─── getSeverity ────────────────────────────────────────────────────────────

describe("getSeverity — minor (< 5°)", () => {
  it("0° → minor", () => expect(getSeverity(0)).toBe("minor"));
  it("1° → minor", () => expect(getSeverity(1)).toBe("minor"));
  it("4° → minor", () => expect(getSeverity(4)).toBe("minor"));
  it("4.9° → minor", () => expect(getSeverity(4.9)).toBe("minor"));
});

describe("getSeverity — moderate (5° – 14.9°)", () => {
  it("5° → moderate (boundary)", () => expect(getSeverity(5)).toBe("moderate"));
  it("7° → moderate", () => expect(getSeverity(7)).toBe("moderate"));
  it("10° → moderate", () => expect(getSeverity(10)).toBe("moderate"));
  it("14° → moderate", () => expect(getSeverity(14)).toBe("moderate"));
  it("14.9° → moderate", () => expect(getSeverity(14.9)).toBe("moderate"));
});

describe("getSeverity — major (≥ 15°)", () => {
  it("15° → major (boundary)", () => expect(getSeverity(15)).toBe("major"));
  it("20° → major", () => expect(getSeverity(20)).toBe("major"));
  it("30° → major", () => expect(getSeverity(30)).toBe("major"));
});

describe("getSeverity — negative delta (sign ignored)", () => {
  it("-3° → minor", () => expect(getSeverity(-3)).toBe("minor"));
  it("-10° → moderate", () => expect(getSeverity(-10)).toBe("moderate"));
  it("-20° → major", () => expect(getSeverity(-20)).toBe("major"));
});

// ─── JOINT_ADJUSTMENTS ──────────────────────────────────────────────────────

describe("JOINT_ADJUSTMENTS — knee", () => {
  it("knee low → raise saddle", () => {
    expect(JOINT_ADJUSTMENTS.knee?.low.adjustmentType).toBe("saddle_height");
    expect(JOINT_ADJUSTMENTS.knee?.low.direction).toBe("raise");
  });

  it("knee high → lower saddle", () => {
    expect(JOINT_ADJUSTMENTS.knee?.high.adjustmentType).toBe("saddle_height");
    expect(JOINT_ADJUSTMENTS.knee?.high.direction).toBe("lower");
  });
});

describe("JOINT_ADJUSTMENTS — hip", () => {
  it("hip low → raise handlebar", () => {
    expect(JOINT_ADJUSTMENTS.hip?.low.adjustmentType).toBe("handlebar_height");
    expect(JOINT_ADJUSTMENTS.hip?.low.direction).toBe("raise");
  });

  it("hip high → lower handlebar", () => {
    expect(JOINT_ADJUSTMENTS.hip?.high.adjustmentType).toBe("handlebar_height");
    expect(JOINT_ADJUSTMENTS.hip?.high.direction).toBe("lower");
  });
});

describe("JOINT_ADJUSTMENTS — shoulder", () => {
  it("shoulder low → raise handlebar", () => {
    expect(JOINT_ADJUSTMENTS.shoulder?.low.adjustmentType).toBe("handlebar_height");
    expect(JOINT_ADJUSTMENTS.shoulder?.low.direction).toBe("raise");
  });

  it("shoulder high → lower handlebar", () => {
    expect(JOINT_ADJUSTMENTS.shoulder?.high.adjustmentType).toBe("handlebar_height");
    expect(JOINT_ADJUSTMENTS.shoulder?.high.direction).toBe("lower");
  });
});

describe("JOINT_ADJUSTMENTS — elbow", () => {
  it("elbow low → lengthen stem", () => {
    expect(JOINT_ADJUSTMENTS.elbow?.low.adjustmentType).toBe("stem_length");
    expect(JOINT_ADJUSTMENTS.elbow?.low.direction).toBe("lengthen");
  });

  it("elbow high → shorten stem", () => {
    expect(JOINT_ADJUSTMENTS.elbow?.high.adjustmentType).toBe("stem_length");
    expect(JOINT_ADJUSTMENTS.elbow?.high.direction).toBe("shorten");
  });
});

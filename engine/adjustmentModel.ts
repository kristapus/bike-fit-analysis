import type { Joint } from "../types";
import type {
  AdjustmentType,
  AdjustmentDirection,
  RecommendationSeverity,
} from "../types";

// Empirical sensitivity: degrees of angle change per 1 cm of physical adjustment.
// Sources: Holmes (1994) knee flexion study, BikeFit practitioner guidelines.
const DEG_PER_CM: Record<Exclude<AdjustmentType, "none">, number> = {
  saddle_height: 4,    // 1 cm saddle raise ≈ 4° BDC knee extension
  handlebar_height: 3, // 1 cm bar raise ≈ 3° hip / shoulder opening
  stem_length: 4,      // 1 cm longer stem ≈ 4° elbow extension
};

export function calcMagnitudeCm(
  deltaDeg: number,
  adjustmentType: AdjustmentType,
): number {
  if (adjustmentType === "none") return 0;
  const sensitivity = DEG_PER_CM[adjustmentType];
  // Round to nearest 0.5 cm – standard bike fitting increment
  return Math.round((Math.abs(deltaDeg) / sensitivity) * 2) / 2;
}

export function getSeverity(deltaDeg: number): RecommendationSeverity {
  const abs = Math.abs(deltaDeg);
  if (abs < 5) return "minor";
  if (abs < 15) return "moderate";
  return "major";
}

type Status = "low" | "high";

interface JointAdjustmentSpec {
  adjustmentType: AdjustmentType;
  direction: AdjustmentDirection;
}

// Primary physical adjustment for each joint × direction.
// knee  → saddle height (BDC angle most sensitive to seat height)
// hip   → handlebar height (forward lean determined by bar stack)
// shoulder → handlebar height (bar height drives shoulder angle)
// elbow → stem length (reach determines elbow flexion)
export const JOINT_ADJUSTMENTS: Partial<
  Record<Joint, Record<Status, JointAdjustmentSpec>>
> = {
  knee: {
    low:  { adjustmentType: "saddle_height",    direction: "raise" },
    high: { adjustmentType: "saddle_height",    direction: "lower" },
  },
  hip: {
    low:  { adjustmentType: "handlebar_height", direction: "raise" },
    high: { adjustmentType: "handlebar_height", direction: "lower" },
  },
  shoulder: {
    low:  { adjustmentType: "handlebar_height", direction: "raise" },
    high: { adjustmentType: "handlebar_height", direction: "lower" },
  },
  elbow: {
    low:  { adjustmentType: "stem_length",      direction: "lengthen" },
    high: { adjustmentType: "stem_length",      direction: "shorten"  },
  },
};

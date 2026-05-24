/**
 * @packageDocumentation
 * Physical adjustment model: sensitivity coefficients and severity classification
 * used to translate angular deviations into concrete bike fitting recommendations.
 *
 * Sources: Holmes (1994) knee flexion study, BikeFit practitioner guidelines.
 */

import type { Joint } from "../types";
import type {
  AdjustmentType,
  AdjustmentDirection,
  RecommendationSeverity,
} from "../types";

/**
 * Empirical sensitivity coefficients: degrees of angle change per 1 cm of physical adjustment.
 *
 * | Adjustment       | Sensitivity | Reference                          |
 * |------------------|-------------|------------------------------------|
 * | `saddle_height`  | 4 °/cm      | Holmes (1994) BDC knee extension   |
 * | `handlebar_height` | 3 °/cm    | BikeFit practitioner guidelines    |
 * | `stem_length`    | 4 °/cm      | BikeFit practitioner guidelines    |
 *
 * @internal
 */
const DEG_PER_CM: Record<Exclude<AdjustmentType, "none">, number> = {
  saddle_height: 4,
  handlebar_height: 3,
  stem_length: 4,
};

/**
 * Calculates the recommended physical adjustment magnitude in centimetres
 * based on the angular deviation and the adjustment type's sensitivity coefficient.
 *
 * The result is rounded to the nearest 0.5 cm, which is the standard
 * increment used in professional bike fitting practice.
 *
 * @param deltaDeg       - Angular deviation from the normative boundary (degrees). Sign is ignored.
 * @param adjustmentType - Type of physical adjustment to apply.
 * @returns Recommended adjustment magnitude in centimetres, rounded to the nearest 0.5 cm.
 *          Returns `0` when `adjustmentType` is `"none"`.
 *
 * @example
 * calcMagnitudeCm(6, "saddle_height");  // → 1.5
 * calcMagnitudeCm(3, "handlebar_height"); // → 1
 * calcMagnitudeCm(5, "none"); // → 0
 */
export function calcMagnitudeCm(
  deltaDeg: number,
  adjustmentType: AdjustmentType,
): number {
  if (adjustmentType === "none") return 0;
  const sensitivity = DEG_PER_CM[adjustmentType];
  return Math.round((Math.abs(deltaDeg) / sensitivity) * 2) / 2;
}

/**
 * Determines the severity level of a fitting recommendation
 * based on the absolute angular deviation from the normative boundary.
 *
 * | Deviation  | Severity   |
 * |------------|------------|
 * | < 5°       | `minor`    |
 * | 5° – 15°   | `moderate` |
 * | > 15°      | `major`    |
 *
 * @param deltaDeg - Angular deviation from the normative boundary (degrees). Sign is ignored.
 * @returns Severity level of the recommendation.
 *
 * @example
 * getSeverity(3);  // → "minor"
 * getSeverity(10); // → "moderate"
 * getSeverity(20); // → "major"
 */
export function getSeverity(deltaDeg: number): RecommendationSeverity {
  const abs = Math.abs(deltaDeg);
  if (abs < 5) return "minor";
  if (abs < 15) return "moderate";
  return "major";
}

/** @internal */
type Status = "low" | "high";

/**
 * Specification of the primary physical adjustment for a given joint and deviation direction.
 * @internal
 */
interface JointAdjustmentSpec {
  adjustmentType: AdjustmentType;
  direction: AdjustmentDirection;
}

/**
 * Primary physical adjustment mapping for each joint and deviation direction.
 *
 * Rationale:
 * - `knee`     → saddle height (BDC knee angle is most sensitive to seat height)
 * - `hip`      → handlebar height (forward lean is determined by bar stack)
 * - `shoulder` → handlebar height (bar height drives shoulder angle)
 * - `elbow`    → stem length (reach determines elbow flexion)
 *
 * @internal
 */
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

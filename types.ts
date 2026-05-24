/**
 * @packageDocumentation
 * Shared types and interfaces used throughout the `@bike-fit/analysis` component.
 * All types listed here are part of the public API.
 */

/**
 * Analysable body joints.
 * Angles are computed for: `knee`, `hip`, `shoulder`, `elbow`.
 * `ankle` and `wrist` are reserved for future use.
 */
export type Joint = "knee" | "hip" | "ankle" | "shoulder" | "elbow" | "wrist";

/** Supported bicycle types that determine which normative angle ranges are applied. */
export const BICYCLE_TYPES = ["road", "gravel", "mountain", "city"] as const;

/**
 * Bicycle type used to select the appropriate normative angle ranges.
 * - `road`     — road bike (Holmes + Pruitt norms)
 * - `gravel`   — gravel bike (Holmes + Pruitt norms, slightly wider ranges)
 * - `mountain` — mountain bike (Retül norms)
 * - `city`     — city / commuter bike (general comfort guidelines)
 */
export type BicycleType = (typeof BICYCLE_TYPES)[number];

/**
 * Physical adjustment type recommended to correct a joint angle.
 * - `saddle_height`    — raise or lower the saddle
 * - `handlebar_height` — raise or lower the handlebar stack
 * - `stem_length`      — lengthen or shorten the stem
 * - `none`             — no adjustment required
 */
export type AdjustmentType =
  | "saddle_height"
  | "handlebar_height"
  | "stem_length"
  | "none";

/**
 * Direction of the recommended physical adjustment.
 * - `raise`    — move the component upward
 * - `lower`    — move the component downward
 * - `lengthen` — increase reach
 * - `shorten`  — decrease reach
 * - `none`     — no directional change required
 */
export type AdjustmentDirection =
  | "raise"
  | "lower"
  | "lengthen"
  | "shorten"
  | "none";

/**
 * Severity level of a fitting recommendation based on the angular deviation from the norm boundary.
 * - `minor`    — deviation < 5°
 * - `moderate` — deviation 5–15°
 * - `major`    — deviation > 15°
 */
export type RecommendationSeverity = "minor" | "moderate" | "major";

/**
 * A single bike fitting recommendation for one joint.
 * Produced by `buildRecommendations()`.
 */
export interface Recommendation {
  /**
   * i18n translation key for the recommendation text.
   * May contain an `{{amount}}` placeholder for the adjustment magnitude.
   * Example: `"recommendations.knee.low"`
   */
  text: string;

  /** The joint this recommendation applies to. */
  joint?: Joint;

  /**
   * Evaluation result for this joint:
   * - `ok`   — angle is within the normative range
   * - `low`  — angle is below the normative minimum
   * - `high` — angle is above the normative maximum
   */
  status?: "ok" | "low" | "high";

  /** Recommended type of physical adjustment. */
  adjustmentType?: AdjustmentType;

  /** Recommended direction of the physical adjustment. */
  direction?: AdjustmentDirection;

  /**
   * Recommended adjustment magnitude in centimetres.
   * Always rounded to the nearest 0.5 cm (standard bike fitting increment).
   * `0` means no adjustment is needed.
   */
  magnitudeCm?: number;

  /** Severity level of this recommendation. */
  severity?: RecommendationSeverity;
}

/**
 * Statistical summary of a single joint's angles across all analysed video frames,
 * enriched with normative ranges for the selected bicycle type.
 * Produced by `buildJointSummaries()`.
 */
export interface JointSummary {
  /** The joint this summary describes. */
  joint: Joint;

  /** Minimum angle recorded across all frames (degrees). */
  min: number;

  /** Maximum angle recorded across all frames (degrees). */
  max: number;

  /** Mean angle across all frames (degrees). */
  avg: number;

  /**
   * The value actually compared against the normative range.
   * Depends on the joint: `max` for knee, `min` for hip, `avg` for shoulder and elbow.
   * Falls back to `avg` when omitted (backward compatibility).
   */
  measuredValue?: number;

  /** Lower bound of the normative range (degrees) for the selected bicycle type. */
  normMin: number;

  /** Upper bound of the normative range (degrees) for the selected bicycle type. */
  normMax: number;
}

/**
 * Joint angles (in degrees) computed from a single video frame.
 * All fields are optional — an angle is only present when all three keypoints
 * required for that joint were detected with sufficient confidence (score ≥ 0.3).
 */
export interface FrameAngles {
  /** Knee angle in degrees (thigh–knee–ankle). */
  knee?: number;

  /** Hip angle in degrees (shoulder–hip–knee). */
  hip?: number;

  /** Shoulder angle in degrees (elbow–shoulder–hip). */
  shoulder?: number;

  /** Elbow angle in degrees (wrist–elbow–shoulder). */
  elbow?: number;
}

/**
 * Biomechanical fitting standard used as the source for normative angle ranges.
 * - `holmes`  — Holmes et al. (1994) knee flexion study
 * - `pruitt`  — Andy Pruitt / BikeFit methodology
 * - `retul`   — Retül dynamic fitting system (Specialized)
 * - `general` — General comfort guidelines
 */
export type FittingStandard = "holmes" | "pruitt" | "retul" | "general";

/**
 * Optional metadata attached to a bike fitting result for identification and storage purposes.
 */
export interface BikeFitResultsMeta {
  /** Bicycle name (manufacturer + model). */
  bicycleName?: string;

  /** ISO date string of when the analysis was performed. */
  performedAt?: string;

  /** Name of the pose detection model used (e.g. `"MoveNet"`, `"BlazePose"`). */
  poseModel?: string;
}

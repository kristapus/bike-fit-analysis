/**
 * @packageDocumentation
 * Core angle computation, joint summaries, and recommendation generation.
 *
 * This module implements the three public functions of `@bike-fit/analysis`:
 * {@link computeFrameAngles}, {@link buildJointSummaries}, and {@link buildRecommendations}.
 *
 * Normative angle ranges are derived from:
 * - **Holmes (1994)** — clinical knee flexion study, injury prevention focus
 * - **Pruitt / BikeFit** — performance-oriented road fit methodology
 * - **Retül** (Specialized) — dynamic fit system, wider ranges for MTB / flexible riders
 */

import type * as poseDetection from "@tensorflow-models/pose-detection";
import type { BicycleType, Joint, JointSummary, Recommendation, FrameAngles, FittingStandard } from "../types";
import {
  calcMagnitudeCm,
  getSeverity,
  JOINT_ADJUSTMENTS,
} from "./adjustmentModel";

/**
 * Computes the angle (in degrees) at vertex `b` formed by points `a`, `b`, and `c`
 * using the dot product of vectors b→a and b→c.
 *
 * @param a - First point (e.g. thigh landmark)
 * @param b - Vertex point (e.g. knee landmark)
 * @param c - Third point (e.g. ankle landmark)
 * @returns Angle in degrees in the range [0, 180]. Returns `0` if either vector has zero magnitude.
 *
 * @internal
 */
function vectorAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return (
    (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI
  );
}

/**
 * Minimum keypoint confidence score required for a landmark to be used in angle computation.
 * Keypoints with a score below this threshold are treated as undetected.
 * @internal
 */
const MIN_CONF = 0.3;

/** @internal */
const SIDE_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;

/**
 * Computes joint angles (in degrees) from a single video frame's pose keypoints.
 *
 * The function automatically selects the better-visible body side (left or right)
 * by comparing the sum of confidence scores across all side joints.
 * Keypoints with a confidence score below `0.3` are ignored.
 *
 * @param kps - Array of keypoints returned by `@tensorflow-models/pose-detection`
 *              for a single detected pose.
 * @returns A {@link FrameAngles} object. Fields are `undefined` when the required
 *          keypoints for that joint were not detected with sufficient confidence.
 *
 * @example
 * const poses = await detector.estimatePoses(videoElement);
 * const angles = computeFrameAngles(poses[0].keypoints);
 * // → { knee: 152.3, hip: 58.1, shoulder: 91.4, elbow: 158.7 }
 */
export function computeFrameAngles(kps: poseDetection.Keypoint[]): FrameAngles {
  const byName = (name: string): poseDetection.Keypoint | null => {
    const kp = kps.find((k) => k.name === name);
    return kp && (kp.score ?? 0) >= MIN_CONF ? kp : null;
  };

  const sideScore = (side: string) =>
    SIDE_JOINTS.reduce((sum, joint) => {
      const kp = kps.find((k) => k.name === `${side}_${joint}`);
      return sum + (kp?.score ?? 0);
    }, 0);

  const side = sideScore("right") >= sideScore("left") ? "right" : "left";

  const s = byName(`${side}_shoulder`);
  const e = byName(`${side}_elbow`);
  const w = byName(`${side}_wrist`);
  const h = byName(`${side}_hip`);
  const k = byName(`${side}_knee`);
  const a = byName(`${side}_ankle`);

  return {
    knee: h && k && a ? vectorAngle(h, k, a) : undefined,
    hip: s && h && k ? vectorAngle(s, h, k) : undefined,
    shoulder: e && s && h ? vectorAngle(e, s, h) : undefined,
    elbow: w && e && s ? vectorAngle(w, e, s) : undefined,
  };
}

/**
 * Aggregate function used to derive the single representative value
 * compared against the normative range.
 * @internal
 */
type NormAggregate = "min" | "max" | "avg";

/** Re-export for external consumers who need to reference fitting standards. */
export type { FittingStandard };

/**
 * Internal normative range definition for a single joint.
 * @internal
 */
interface JointNorm {
  /** Lower bound of the normative range (degrees). */
  min: number;
  /** Upper bound of the normative range (degrees). */
  max: number;
  /** Which pedal-stroke aggregate to compare against this norm. */
  aggregate: NormAggregate;
  /** Biomechanical standards this range is derived from. */
  source: FittingStandard[];
}

/**
 * Normative angle ranges (degrees) per bicycle type and joint.
 *
 * | Joint    | Road      | Gravel    | Mountain  | City      | Aggregate |
 * |----------|-----------|-----------|-----------|-----------|-----------|
 * | knee     | 140–155°  | 135–152°  | 130–148°  | 128–148°  | max       |
 * | hip      | 45–65°    | 50–70°    | 55–75°    | 60–80°    | min       |
 * | shoulder | 80–100°   | 85–105°   | 90–110°   | 95–115°   | avg       |
 * | elbow    | 150–165°  | 145–167°  | 140–165°  | 145–168°  | avg       |
 *
 * @internal
 */
const ANGLE_NORMS: Record<BicycleType, Partial<Record<Joint, JointNorm>>> = {
  road: {
    knee:     { min: 140, max: 155, aggregate: "max", source: ["holmes", "pruitt"] },
    hip:      { min: 45,  max: 65,  aggregate: "min", source: ["pruitt"] },
    shoulder: { min: 80,  max: 100, aggregate: "avg", source: ["pruitt"] },
    elbow:    { min: 150, max: 165, aggregate: "avg", source: ["pruitt"] },
  },
  gravel: {
    knee:     { min: 135, max: 152, aggregate: "max", source: ["holmes", "pruitt"] },
    hip:      { min: 50,  max: 70,  aggregate: "min", source: ["pruitt"] },
    shoulder: { min: 85,  max: 105, aggregate: "avg", source: ["pruitt"] },
    elbow:    { min: 145, max: 167, aggregate: "avg", source: ["pruitt"] },
  },
  mountain: {
    knee:     { min: 130, max: 148, aggregate: "max", source: ["retul"] },
    hip:      { min: 55,  max: 75,  aggregate: "min", source: ["retul"] },
    shoulder: { min: 90,  max: 110, aggregate: "avg", source: ["retul"] },
    elbow:    { min: 140, max: 165, aggregate: "avg", source: ["retul"] },
  },
  city: {
    knee:     { min: 128, max: 148, aggregate: "max", source: ["general"] },
    hip:      { min: 60,  max: 80,  aggregate: "min", source: ["general"] },
    shoulder: { min: 95,  max: 115, aggregate: "avg", source: ["general"] },
    elbow:    { min: 145, max: 168, aggregate: "avg", source: ["general"] },
  },
};

/**
 * Returns the normative angle range for a given bicycle type and joint.
 *
 * @param bicycleType - The bicycle type.
 * @param joint       - The joint to look up.
 * @returns The {@link JointNorm} for the combination, or `undefined` if not defined.
 *
 * @internal
 */
export function getNorm(
  bicycleType: BicycleType,
  joint: Joint,
): JointNorm | undefined {
  return ANGLE_NORMS[bicycleType][joint];
}

/** Joints for which recommendations are generated. @internal */
const ANALYZABLE_JOINTS: Joint[] = ["knee", "hip", "shoulder", "elbow"];

/**
 * Generates bike fitting recommendations from joint summaries.
 *
 * For each joint, the `measuredValue` (or `avg` as fallback) is compared against
 * `normMin` and `normMax`. If outside the range, the function calculates:
 * - The recommended adjustment type and direction
 * - The adjustment magnitude in centimetres (rounded to nearest 0.5 cm)
 * - The severity level based on the angular deviation
 *
 * @param summaries - Array of {@link JointSummary} objects produced by {@link buildJointSummaries}.
 * @returns Array of {@link Recommendation} objects, one per analysable joint present in `summaries`.
 *
 * @example
 * const recs = buildRecommendations(summaries);
 * // [{
 * //   joint: "knee", status: "low",
 * //   adjustmentType: "saddle_height", direction: "raise",
 * //   magnitudeCm: 1.5, severity: "moderate",
 * //   text: "recommendations.knee.low"
 * // }]
 */
export function buildRecommendations(summaries: JointSummary[]): Recommendation[] {
  return summaries
    .filter((s) => ANALYZABLE_JOINTS.includes(s.joint))
    .map((s) => {
      const v = s.measuredValue ?? s.avg;
      const status: "low" | "high" | "ok" =
        v < s.normMin ? "low" : v > s.normMax ? "high" : "ok";

      if (status === "ok") {
        return {
          text: `recommendations.${s.joint}.ok`,
          joint: s.joint,
          status,
          adjustmentType: "none" as const,
          direction: "none" as const,
          magnitudeCm: 0,
          severity: "minor" as const,
        };
      }

      const delta = v - (status === "low" ? s.normMin : s.normMax);
      const spec = JOINT_ADJUSTMENTS[s.joint]?.[status];
      const adjustmentType = spec?.adjustmentType ?? "none";
      const direction = spec?.direction ?? "none";
      const magnitudeCm = calcMagnitudeCm(delta, adjustmentType);
      const severity = getSeverity(delta);
      const textKey =
        severity === "major"
          ? `recommendations.${s.joint}.${status}_major`
          : `recommendations.${s.joint}.${status}`;

      return {
        text: textKey,
        joint: s.joint,
        status,
        adjustmentType,
        direction,
        magnitudeCm,
        severity,
      };
    });
}

/**
 * Aggregates per-frame angle data into per-joint statistical summaries
 * and attaches normative ranges for the selected bicycle type.
 *
 * Joints with no reliable data across all frames are omitted from the result.
 * The `measuredValue` field is set to the aggregate specified by the norm
 * (`max` for knee, `min` for hip, `avg` for shoulder and elbow).
 *
 * @param frames      - Array of {@link FrameAngles} objects from {@link computeFrameAngles}.
 * @param bicycleType - Bicycle type used to select normative angle ranges.
 * @returns Array of {@link JointSummary} objects. Joints without sufficient data are excluded.
 *
 * @example
 * const summaries = buildJointSummaries(frames, "road");
 * // [{ joint: "knee", min: 138, max: 154, avg: 146, normMin: 140, normMax: 155 }, ...]
 */
export function buildJointSummaries(
  frames: FrameAngles[],
  bicycleType: BicycleType,
): JointSummary[] {
  const joints: (keyof FrameAngles)[] = ["knee", "hip", "shoulder", "elbow"];
  const summaries: JointSummary[] = [];

  for (const joint of joints) {
    const values = frames
      .map((f) => f[joint])
      .filter((v): v is number => v !== undefined && !isNaN(v));

    if (values.length === 0) continue;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const norm = getNorm(bicycleType, joint);
    if (!norm) continue;

    summaries.push({
      joint,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10,
      measuredValue:
        Math.round({ min, avg, max }[norm.aggregate] * 10) / 10,
      normMin: norm.min,
      normMax: norm.max,
    });
  }

  return summaries;
}

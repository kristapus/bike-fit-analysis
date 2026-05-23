import type * as poseDetection from "@tensorflow-models/pose-detection";
import type { BicycleType, Joint, JointSummary, Recommendation, FrameAngles, FittingStandard } from "../types";
import {
  calcMagnitudeCm,
  getSeverity,
  JOINT_ADJUSTMENTS,
} from "./adjustmentModel";

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

const MIN_CONF = 0.3;

const SIDE_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const;

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

type NormAggregate = "min" | "max" | "avg";

// Fitting standards used in ANGLE_NORMS below.
// Holmes: clinical knee-flexion study (Holmes et al., 1994) — injury prevention focus.
// Pruitt: Andy Pruitt / BikeFit — performance-oriented road fit.
// Retül: dynamic fit system (Specialized/Retül) — wider ranges for MTB / flexible riders.
export type { FittingStandard };

interface JointNorm {
  min: number;
  max: number;
  /** Which pedal-stroke aggregate to compare against this norm */
  aggregate: NormAggregate;
  /** Standard(s) this range is derived from */
  source: FittingStandard[];
}

// Normative angle ranges per bicycle type (degrees).
// road/gravel  → Holmes + Pruitt blend (25–35° flexion at BDC = 145–155° extension)
// mountain     → Retül dynamic (wider knee range; more upright hip/shoulder)
// city         → General upright guidelines (comfort over performance)
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

export function getNorm(
  bicycleType: BicycleType,
  joint: Joint,
): JointNorm | undefined {
  return ANGLE_NORMS[bicycleType][joint];
}

const ANALYZABLE_JOINTS: Joint[] = ["knee", "hip", "shoulder", "elbow"];

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

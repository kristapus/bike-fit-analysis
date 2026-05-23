export type Joint = "knee" | "hip" | "ankle" | "shoulder" | "elbow" | "wrist";

export const BICYCLE_TYPES = ["road", "gravel", "mountain", "city"] as const;
export type BicycleType = (typeof BICYCLE_TYPES)[number];

export type AdjustmentType =
  | "saddle_height"
  | "handlebar_height"
  | "stem_length"
  | "none";

export type AdjustmentDirection =
  | "raise"
  | "lower"
  | "lengthen"
  | "shorten"
  | "none";

export type RecommendationSeverity = "minor" | "moderate" | "major";

export interface Recommendation {
  /** i18n key passed to translate(), may contain {{amount}} placeholder */
  text: string;
  joint?: Joint;
  status?: "ok" | "low" | "high";
  adjustmentType?: AdjustmentType;
  direction?: AdjustmentDirection;
  /** Physical adjustment magnitude in centimetres */
  magnitudeCm?: number;
  severity?: RecommendationSeverity;
}

export interface JointSummary {
  joint: Joint;
  min: number;
  max: number;
  avg: number;
  /** Value actually compared against norms (knee→max, hip→min, others→avg). Optional for backward compat. */
  measuredValue?: number;
  normMin: number;
  normMax: number;
}

export interface FrameAngles {
  knee?: number;
  hip?: number;
  shoulder?: number;
  elbow?: number;
}

export type FittingStandard = "holmes" | "pruitt" | "retul" | "general";

export interface BikeFitResultsMeta {
  bicycleName?: string;
  /** ISO date string */
  performedAt?: string;
  poseModel?: string;
}

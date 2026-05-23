// Engine — framework-agnostic, no React dependency
export {
  computeFrameAngles,
  buildJointSummaries,
  buildRecommendations,
  getNorm,
} from "./engine/angleCalculation";
export {
  calcMagnitudeCm,
  getSeverity,
  JOINT_ADJUSTMENTS,
} from "./engine/adjustmentModel";

// Types
export type {
  Joint,
  BicycleType,
  JointSummary,
  Recommendation,
  FrameAngles,
  FittingStandard,
  AdjustmentType,
  AdjustmentDirection,
  RecommendationSeverity,
  BikeFitResultsMeta,
} from "./types";
export { BICYCLE_TYPES } from "./types";

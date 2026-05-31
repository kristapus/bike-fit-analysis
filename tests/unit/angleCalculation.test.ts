import { describe, it, expect } from "vitest";
import {
  computeFrameAngles,
  buildJointSummaries,
  buildRecommendations,
  getNorm,
} from "../../engine/angleCalculation";
import type { FrameAngles, JointSummary } from "../../types";

// ─── Keypoint helpers ────────────────────────────────────────────────────────

function kp(name: string, x: number, y: number, score = 1.0) {
  return { name, x, y, score };
}

/** Builds a full right-side pose at geometrically known positions. */
function rightSideKps(overrides: Record<string, { x: number; y: number; score?: number }> = {}) {
  const defaults: Record<string, { x: number; y: number; score: number }> = {
    right_shoulder: { x: 0, y: 0, score: 1 },
    right_elbow:    { x: 1, y: 0, score: 1 },
    right_wrist:    { x: 2, y: 0, score: 1 },
    right_hip:      { x: 0, y: 1, score: 1 },
    right_knee:     { x: 0, y: 2, score: 1 },
    right_ankle:    { x: 0, y: 3, score: 1 },
  };
  const merged = { ...defaults };
  for (const [name, pos] of Object.entries(overrides)) {
    merged[name] = { score: 1, ...pos };
  }
  return Object.entries(merged).map(([name, { x, y, score }]) => kp(name, x, y, score));
}

// ─── getNorm ─────────────────────────────────────────────────────────────────

describe("getNorm", () => {
  it("road/knee → min 140, max 155", () => {
    const n = getNorm("road", "knee");
    expect(n?.min).toBe(140);
    expect(n?.max).toBe(155);
  });

  it("road/hip → min 45, max 65", () => {
    const n = getNorm("road", "hip");
    expect(n?.min).toBe(45);
    expect(n?.max).toBe(65);
  });

  it("gravel/knee → min 135, max 152", () => {
    const n = getNorm("gravel", "knee");
    expect(n?.min).toBe(135);
    expect(n?.max).toBe(152);
  });

  it("mountain/knee → min 130, max 148", () => {
    const n = getNorm("mountain", "knee");
    expect(n?.min).toBe(130);
    expect(n?.max).toBe(148);
  });

  it("city/knee → min 128, max 148", () => {
    const n = getNorm("city", "knee");
    expect(n?.min).toBe(128);
    expect(n?.max).toBe(148);
  });

  it("knee uses max aggregate", () => {
    expect(getNorm("road", "knee")?.aggregate).toBe("max");
  });

  it("hip uses min aggregate", () => {
    expect(getNorm("road", "hip")?.aggregate).toBe("min");
  });

  it("shoulder uses avg aggregate", () => {
    expect(getNorm("road", "shoulder")?.aggregate).toBe("avg");
  });

  it("elbow uses avg aggregate", () => {
    expect(getNorm("road", "elbow")?.aggregate).toBe("avg");
  });

  it("ankle is not defined (not analysable)", () => {
    expect(getNorm("road", "ankle")).toBeUndefined();
  });

  it("wrist is not defined", () => {
    expect(getNorm("road", "wrist")).toBeUndefined();
  });
});

// ─── computeFrameAngles ──────────────────────────────────────────────────────

describe("computeFrameAngles — empty keypoints", () => {
  it("returns all undefined when no keypoints provided", () => {
    const angles = computeFrameAngles([]);
    expect(angles.knee).toBeUndefined();
    expect(angles.hip).toBeUndefined();
    expect(angles.shoulder).toBeUndefined();
    expect(angles.elbow).toBeUndefined();
  });
});

describe("computeFrameAngles — confidence threshold", () => {
  it("ignores keypoints with score below 0.3", () => {
    const kps = rightSideKps({
      right_hip:   { x: 0, y: 1, score: 0.29 },
    });
    const angles = computeFrameAngles(kps);
    // hip is a required point for both knee and hip angles
    expect(angles.knee).toBeUndefined();
    expect(angles.hip).toBeUndefined();
  });

  it("accepts keypoints with score exactly 0.3", () => {
    const kps = rightSideKps({
      right_hip:   { x: 0, y: 1, score: 0.3 },
    });
    const angles = computeFrameAngles(kps);
    expect(angles.knee).toBeDefined();
    expect(angles.hip).toBeDefined();
  });
});

describe("computeFrameAngles — side selection", () => {
  it("prefers right side when right confidence is higher", () => {
    // right: hip(0,0)→knee(1,0)→ankle(1,1) → 90° at knee
    // left:  hip(0,0)→knee(1,0)→ankle(2,0) → 180° at knee, but score 0 (not usable)
    const kps = [
      kp("right_shoulder", 0, 0, 1),
      kp("right_elbow",    1, 0, 1),
      kp("right_wrist",    2, 0, 1),
      kp("right_hip",      0, 0, 1),
      kp("right_knee",     1, 0, 1),
      kp("right_ankle",    1, 1, 1),
      kp("left_shoulder",  0, 0, 0),
      kp("left_elbow",     1, 0, 0),
      kp("left_wrist",     2, 0, 0),
      kp("left_hip",       0, 0, 0),
      kp("left_knee",      1, 0, 0),
      kp("left_ankle",     2, 0, 0),
    ];
    const angles = computeFrameAngles(kps);
    expect(angles.knee).toBeCloseTo(90, 5);
  });

  it("uses left side when left confidence is higher", () => {
    // right: hip(0,0)→knee(1,0)→ankle(1,1) → 90° at knee, but score 0 (not usable)
    // left:  hip(0,0)→knee(1,0)→ankle(2,0) → 180° at knee
    const kps = [
      kp("right_shoulder", 0, 0, 0),
      kp("right_elbow",    1, 0, 0),
      kp("right_wrist",    2, 0, 0),
      kp("right_hip",      0, 0, 0),
      kp("right_knee",     1, 0, 0),
      kp("right_ankle",    1, 1, 0),
      kp("left_shoulder",  0, 0, 1),
      kp("left_elbow",     1, 0, 1),
      kp("left_wrist",     2, 0, 1),
      kp("left_hip",       0, 0, 1),
      kp("left_knee",      1, 0, 1),
      kp("left_ankle",     2, 0, 1),
    ];
    const angles = computeFrameAngles(kps);
    expect(angles.knee).toBeCloseTo(180, 5);
  });
});

describe("computeFrameAngles — geometry", () => {
  it("straight limb (collinear points) → 180°", () => {
    // hip(0,0) → knee(1,0) → ankle(2,0): straight line
    const kps = rightSideKps({
      right_hip:   { x: 0, y: 0 },
      right_knee:  { x: 1, y: 0 },
      right_ankle: { x: 2, y: 0 },
    });
    const angles = computeFrameAngles(kps);
    expect(angles.knee).toBeCloseTo(180, 5);
  });

  it("right-angle limb → 90°", () => {
    // hip(0,0) → knee(1,0) → ankle(1,1): 90° at knee
    const kps = rightSideKps({
      right_hip:   { x: 0, y: 0 },
      right_knee:  { x: 1, y: 0 },
      right_ankle: { x: 1, y: 1 },
    });
    const angles = computeFrameAngles(kps);
    expect(angles.knee).toBeCloseTo(90, 5);
  });

  it("straight shoulder → elbow → wrist → 180°", () => {
    const kps = rightSideKps({
      right_shoulder: { x: 0, y: 0 },
      right_elbow:    { x: 1, y: 0 },
      right_wrist:    { x: 2, y: 0 },
    });
    const angles = computeFrameAngles(kps);
    expect(angles.elbow).toBeCloseTo(180, 5);
  });

  it("right-angle elbow → 90°", () => {
    const kps = rightSideKps({
      right_wrist:    { x: 0, y: 0 },
      right_elbow:    { x: 1, y: 0 },
      right_shoulder: { x: 1, y: 1 },
    });
    const angles = computeFrameAngles(kps);
    expect(angles.elbow).toBeCloseTo(90, 5);
  });

  it("all angles defined when all keypoints present with high confidence", () => {
    const angles = computeFrameAngles(rightSideKps());
    expect(angles.knee).toBeDefined();
    expect(angles.hip).toBeDefined();
    expect(angles.shoulder).toBeDefined();
    expect(angles.elbow).toBeDefined();
  });
});

// ─── buildJointSummaries ─────────────────────────────────────────────────────

describe("buildJointSummaries — empty / no data", () => {
  it("returns empty array for empty frames", () => {
    expect(buildJointSummaries([], "road")).toHaveLength(0);
  });

  it("returns empty array when all frame values are undefined", () => {
    const frames: FrameAngles[] = [{ knee: undefined, hip: undefined, shoulder: undefined, elbow: undefined }];
    expect(buildJointSummaries(frames, "road")).toHaveLength(0);
  });

  it("omits joint with no valid values across any frame", () => {
    const frames: FrameAngles[] = [{ knee: 145, hip: undefined, shoulder: undefined, elbow: undefined }];
    const summaries = buildJointSummaries(frames, "road");
    expect(summaries).toHaveLength(1);
    expect(summaries[0].joint).toBe("knee");
  });
});

describe("buildJointSummaries — statistics", () => {
  it("computes correct min, max, avg from multiple frames", () => {
    const frames: FrameAngles[] = [
      { knee: 140 },
      { knee: 150 },
      { knee: 160 },
    ];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.min).toBe(140);
    expect(summary.max).toBe(160);
    expect(summary.avg).toBe(150);
  });

  it("rounds min/max/avg to one decimal place", () => {
    const frames: FrameAngles[] = [
      { knee: 140.123 },
      { knee: 150.456 },
    ];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.min).toBe(140.1);
    expect(summary.max).toBe(150.5);
    expect(summary.avg).toBe(145.3);
  });

  it("handles single frame", () => {
    const frames: FrameAngles[] = [{ knee: 148 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.min).toBe(148);
    expect(summary.max).toBe(148);
    expect(summary.avg).toBe(148);
  });
});

describe("buildJointSummaries — normative ranges", () => {
  it("attaches correct normMin/normMax for road/knee", () => {
    const norm = getNorm("road", "knee")!;
    const frames: FrameAngles[] = [{ knee: 148 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.normMin).toBe(norm.min);
    expect(summary.normMax).toBe(norm.max);
  });

  it("attaches correct normMin/normMax for mountain/knee", () => {
    const norm = getNorm("mountain", "knee")!;
    const frames: FrameAngles[] = [{ knee: 138 }];
    const [summary] = buildJointSummaries(frames, "mountain");
    expect(summary.normMin).toBe(norm.min);
    expect(summary.normMax).toBe(norm.max);
  });
});

describe("buildJointSummaries — measuredValue aggregate", () => {
  it("knee measuredValue = max", () => {
    const frames: FrameAngles[] = [{ knee: 140 }, { knee: 155 }, { knee: 148 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.measuredValue).toBe(155); // max
  });

  it("hip measuredValue = min", () => {
    const frames: FrameAngles[] = [{ hip: 60 }, { hip: 50 }, { hip: 55 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.measuredValue).toBe(50); // min
  });

  it("shoulder measuredValue = avg", () => {
    const frames: FrameAngles[] = [{ shoulder: 80 }, { shoulder: 100 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.measuredValue).toBe(90); // avg
  });

  it("elbow measuredValue = avg", () => {
    const frames: FrameAngles[] = [{ elbow: 150 }, { elbow: 160 }];
    const [summary] = buildJointSummaries(frames, "road");
    expect(summary.measuredValue).toBe(155); // avg
  });
});

// ─── buildRecommendations ────────────────────────────────────────────────────

function makeSummary(
  joint: JointSummary["joint"],
  measuredValue: number,
  normMin: number,
  normMax: number,
): JointSummary {
  return { joint, min: measuredValue, max: measuredValue, avg: measuredValue, measuredValue, normMin, normMax };
}

describe("buildRecommendations — empty input", () => {
  it("returns empty array for empty summaries", () => {
    expect(buildRecommendations([])).toHaveLength(0);
  });
});

describe("buildRecommendations — status ok", () => {
  it("returns ok recommendation when value is within range", () => {
    const [rec] = buildRecommendations([makeSummary("knee", 148, 140, 155)]);
    expect(rec.status).toBe("ok");
    expect(rec.adjustmentType).toBe("none");
    expect(rec.direction).toBe("none");
    expect(rec.magnitudeCm).toBe(0);
    expect(rec.text).toBe("recommendations.knee.ok");
  });

  it("ok when value equals normMin (boundary)", () => {
    const [rec] = buildRecommendations([makeSummary("knee", 140, 140, 155)]);
    expect(rec.status).toBe("ok");
  });

  it("ok when value equals normMax (boundary)", () => {
    const [rec] = buildRecommendations([makeSummary("knee", 155, 140, 155)]);
    expect(rec.status).toBe("ok");
  });
});

describe("buildRecommendations — status low", () => {
  it("knee below range → raise saddle", () => {
    const [rec] = buildRecommendations([makeSummary("knee", 135, 140, 155)]);
    expect(rec.status).toBe("low");
    expect(rec.adjustmentType).toBe("saddle_height");
    expect(rec.direction).toBe("raise");
  });

  it("hip below range → raise handlebar", () => {
    const [rec] = buildRecommendations([makeSummary("hip", 40, 45, 65)]);
    expect(rec.status).toBe("low");
    expect(rec.adjustmentType).toBe("handlebar_height");
    expect(rec.direction).toBe("raise");
  });

  it("elbow below range → lengthen stem", () => {
    const [rec] = buildRecommendations([makeSummary("elbow", 145, 150, 165)]);
    expect(rec.status).toBe("low");
    expect(rec.adjustmentType).toBe("stem_length");
    expect(rec.direction).toBe("lengthen");
  });
});

describe("buildRecommendations — status high", () => {
  it("knee above range → lower saddle", () => {
    const [rec] = buildRecommendations([makeSummary("knee", 160, 140, 155)]);
    expect(rec.status).toBe("high");
    expect(rec.adjustmentType).toBe("saddle_height");
    expect(rec.direction).toBe("lower");
  });

  it("shoulder above range → lower handlebar", () => {
    const [rec] = buildRecommendations([makeSummary("shoulder", 110, 80, 100)]);
    expect(rec.status).toBe("high");
    expect(rec.adjustmentType).toBe("handlebar_height");
    expect(rec.direction).toBe("lower");
  });

  it("elbow above range → shorten stem", () => {
    const [rec] = buildRecommendations([makeSummary("elbow", 170, 150, 165)]);
    expect(rec.status).toBe("high");
    expect(rec.adjustmentType).toBe("stem_length");
    expect(rec.direction).toBe("shorten");
  });
});

describe("buildRecommendations — magnitude", () => {
  it("5° below knee norm → 1.25 cm rounded to 1.5 cm", () => {
    // delta = 135 - 140 = -5, saddle_height 4°/cm → 5/4=1.25 → rounds to 1.5
    const [rec] = buildRecommendations([makeSummary("knee", 135, 140, 155)]);
    expect(rec.magnitudeCm).toBe(1.5);
  });

  it("8° above knee norm → 2.0 cm", () => {
    // delta = 163 - 155 = 8, saddle_height 4°/cm → 8/4 = 2.0
    const [rec] = buildRecommendations([makeSummary("knee", 163, 140, 155)]);
    expect(rec.magnitudeCm).toBe(2.0);
  });
});

describe("buildRecommendations — severity and text key", () => {
  it("minor deviation → severity minor, normal text key", () => {
    // 3° below → minor
    const [rec] = buildRecommendations([makeSummary("knee", 137, 140, 155)]);
    expect(rec.severity).toBe("minor");
    expect(rec.text).toBe("recommendations.knee.low");
  });

  it("moderate deviation → severity moderate, normal text key", () => {
    // 8° below → moderate
    const [rec] = buildRecommendations([makeSummary("knee", 132, 140, 155)]);
    expect(rec.severity).toBe("moderate");
    expect(rec.text).toBe("recommendations.knee.low");
  });

  it("major deviation (≥ 15°) → severity major, _major text key", () => {
    // 16° below → major
    const [rec] = buildRecommendations([makeSummary("knee", 124, 140, 155)]);
    expect(rec.severity).toBe("major");
    expect(rec.text).toBe("recommendations.knee.low_major");
  });

  it("major high deviation → _major text key", () => {
    // 20° above → major
    const [rec] = buildRecommendations([makeSummary("knee", 175, 140, 155)]);
    expect(rec.severity).toBe("major");
    expect(rec.text).toBe("recommendations.knee.high_major");
  });
});

describe("buildRecommendations — uses measuredValue over avg", () => {
  it("uses measuredValue when provided", () => {
    const summary: JointSummary = {
      joint: "knee", min: 130, max: 160, avg: 145,
      measuredValue: 130, // below norm → should be "low"
      normMin: 140, normMax: 155,
    };
    const [rec] = buildRecommendations([summary]);
    expect(rec.status).toBe("low");
  });

  it("falls back to avg when measuredValue is undefined", () => {
    const summary: JointSummary = {
      joint: "knee", min: 130, max: 160, avg: 160,
      measuredValue: undefined,
      normMin: 140, normMax: 155,
    };
    const [rec] = buildRecommendations([summary]);
    expect(rec.status).toBe("high"); // avg 160 > normMax 155
  });
});

describe("buildRecommendations — filters non-analysable joints", () => {
  it("excludes ankle joint", () => {
    const summary: JointSummary = {
      joint: "ankle", min: 90, max: 90, avg: 90,
      normMin: 80, normMax: 100,
    };
    expect(buildRecommendations([summary])).toHaveLength(0);
  });

  it("excludes wrist joint", () => {
    const summary: JointSummary = {
      joint: "wrist", min: 90, max: 90, avg: 90,
      normMin: 80, normMax: 100,
    };
    expect(buildRecommendations([summary])).toHaveLength(0);
  });

  it("includes all four analysable joints when present", () => {
    const summaries = [
      makeSummary("knee", 148, 140, 155),
      makeSummary("hip", 55, 45, 65),
      makeSummary("shoulder", 90, 80, 100),
      makeSummary("elbow", 158, 150, 165),
    ];
    expect(buildRecommendations(summaries)).toHaveLength(4);
  });
});

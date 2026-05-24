# @bike-fit/analysis

Bike fitting analysis engine: computes joint angles from pose keypoints, compares against bike-type normative ranges, and generates physical adjustment recommendations.

## Installation

```bash
npm install @tensorflow/tfjs @tensorflow-models/pose-detection
npm install @bike-fit/analysis
```

## Peer Dependencies

| Package                             | Version |
| ----------------------------------- | ------- |
| `@tensorflow-models/pose-detection` | ≥ 2.0.0 |
| `@tensorflow/tfjs`                  | ≥ 4.0.0 |

## API

```typescript
import {
  computeFrameAngles, // Compute joint angles from a single frame
  buildJointSummaries, // Aggregate frames into per-joint statistics
  buildRecommendations, // Generate physical adjustment recommendations
} from "@bike-fit/analysis";
```

Full API reference: `docs/api/index.html` (generate with `npm run docs`).

---

## Usage Examples

### Example 1: Minimal usage

The simplest case — analysing a single frame:

```typescript
import {
  computeFrameAngles,
  buildJointSummaries,
  buildRecommendations,
} from "@bike-fit/analysis";

// 1. Get pose keypoints from TF.js
const poses = await detector.estimatePoses(videoElement);

// 2. Compute joint angles for this frame
const angles = computeFrameAngles(poses[0].keypoints);
// → { knee: 152.3, hip: 58.1, shoulder: 91.4, elbow: 158.7 }

// 3. Build a summary (single frame here — use an array in real usage)
const summaries = buildJointSummaries([angles], "road");

// 4. Get recommendations
const recommendations = buildRecommendations(summaries);

recommendations.forEach((rec) => {
  if (rec.status !== "ok") {
    console.log(
      `${rec.joint}: ${rec.direction} ${rec.adjustmentType} by ${rec.magnitudeCm} cm`,
    );
    // → hip: raise handlebar_height by 1.5 cm
  }
});
```

---

### Example 2: Full video analysis

Real-world usage — processing a video file frame by frame with progress tracking:

```typescript
import {
  computeFrameAngles,
  buildJointSummaries,
  buildRecommendations,
  type FrameAngles,
  type BicycleType,
} from "@bike-fit/analysis";

async function analyzeVideo(
  videoElement: HTMLVideoElement,
  detector: poseDetection.PoseDetector,
  bicycleType: BicycleType,
) {
  const STEP = 0.2; // seconds between sampled frames
  const total = Math.ceil(videoElement.duration / STEP);
  const frames: FrameAngles[] = [];

  for (let i = 0; i <= total; i++) {
    // Seek to the next frame position
    await new Promise<void>((resolve) => {
      videoElement.onseeked = () => resolve();
      videoElement.currentTime = i * STEP;
    });

    // Detect pose and compute angles
    const poses = await detector.estimatePoses(videoElement);
    if (poses[0]) {
      frames.push(computeFrameAngles(poses[0].keypoints));
    }
  }

  // Aggregate and generate recommendations
  const summaries = buildJointSummaries(frames, bicycleType);
  const recommendations = buildRecommendations(summaries);

  return { summaries, recommendations };
}
```

---

### Example 3: Displaying recommendations

How to interpret and display results to the end user:

```typescript
import { buildRecommendations, type JointSummary } from "@bike-fit/analysis";

function displayResults(summaries: JointSummary[]) {
  const recommendations = buildRecommendations(summaries);

  recommendations.forEach((rec) => {
    const icon =
      rec.status === "ok"
        ? "✅"
        : rec.severity === "major"
          ? "🔴"
          : rec.severity === "moderate"
            ? "🟡"
            : "🟢";

    console.log(`${icon} ${rec.joint?.toUpperCase()}`);

    if (rec.status === "ok") {
      console.log("   Angle within norm — no adjustment needed.");
    } else {
      console.log(`   Recommended: ${rec.direction} ${rec.adjustmentType}`);
      console.log(`   Magnitude: ~${rec.magnitudeCm} cm`);
      console.log(`   Severity: ${rec.severity}`);
    }
  });
}

// Output:
// ✅ KNEE     — Angle within norm — no adjustment needed.
// 🟡 HIP      — Recommended: raise handlebar_height | ~1.5 cm | moderate
// ✅ SHOULDER — Angle within norm — no adjustment needed.
// 🟢 ELBOW    — Recommended: shorten stem_length | ~0.5 cm | minor
```

---

## Supported Bicycle Types

| Type       | Standards       | Knee norm | Hip norm |
| ---------- | --------------- | --------- | -------- |
| `road`     | Holmes + Pruitt | 140–155°  | 45–65°   |
| `gravel`   | Holmes + Pruitt | 135–152°  | 50–70°   |
| `mountain` | Retül           | 130–148°  | 55–75°   |
| `city`     | General         | 128–148°  | 60–80°   |

## Scripts

```bash
npm run build   # Compile to dist/
npm run docs    # Generate API documentation to docs/api/
npm run typecheck # Type-check without emitting
```

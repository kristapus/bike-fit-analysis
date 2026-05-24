# Changelog

All notable changes to `@bike-fit/analysis` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-24

### Added
- `computeFrameAngles(keypoints)` — computes knee, hip, shoulder and elbow angles from a single pose detection frame
- `buildJointSummaries(frames, bicycleType)` — aggregates per-frame angles into per-joint statistics with normative ranges
- `buildRecommendations(summaries)` — generates physical adjustment recommendations with direction, magnitude (cm) and severity
- Normative angle ranges for four bicycle types: `road`, `gravel`, `mountain`, `city`
- Standards: Holmes (1994), Pruitt/BikeFit, Retül, General comfort guidelines
- Full TypeScript type declarations for all public API members
- JSDoc comments on all exported functions, interfaces and types
- TypeDoc configuration for HTML documentation generation (`npm run docs`)

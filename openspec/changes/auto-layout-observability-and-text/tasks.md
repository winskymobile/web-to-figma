## 1. Inference API and text flow

- [x] 1.1 Add bail reason type + `tryInferAutoLayout` returning ok/value or ok/reason
- [x] 1.2 Allow Text flow items in `collectChildren` with Range-based rects
- [x] 1.3 Keep Element-only child overrides; preserve 0.6 gate

## 2. Diagnostics plumbing

- [x] 2.1 Extend `ConverterDiagnostic` with `layout-infer-bailed` and optional `reason`
- [x] 2.2 Thread `reportDiagnostic` into frame converter; report on bail when layout is auto

## 3. Tests

- [x] 3.1 Flex + direct text becomes HORIZONTAL when geometry verifies
- [x] 3.2 Non-uniform gap still NONE and emits layout-infer-bailed
- [x] 3.3 Run autolayout browser tests / package test suite as available

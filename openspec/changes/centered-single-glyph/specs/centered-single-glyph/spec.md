## ADDED Requirements

### Requirement: Centered single glyph text width matches font size

When text is one grapheme and the host or parent expresses center alignment, the TEXT node width SHALL equal the computed font size (not a narrower measured advance-only box).

### Requirement: Single-child centered box uses centered Auto Layout

When a flex or grid container has exactly one flow child and center placement intent, inference SHALL produce Auto Layout with primary and counter alignment CENTER when geometry verifies.

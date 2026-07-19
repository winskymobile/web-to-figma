## ADDED Requirements

### Requirement: Conversion completeness is visible
The shell SHALL expose the latest conversion's `excluded`, `native`, `degraded`, `skipped`, `error`, and local-raster counts together with actionable resource, font, glyph, and node diagnostics. It SHALL distinguish `complete` native copy, copied `degraded` result, and blocked `failed` result without exposing page text.

#### Scenario: Native copy summary
- **WHEN** copy completes with no degraded, skipped, error, or locally rasterized content
- **THEN** the shell shows a concise native-success summary

#### Scenario: Degraded copy summary
- **WHEN** copy completes with reported non-fatal degradation
- **THEN** the shell shows a persistent warning summary that can reveal diagnostic categories without exposing page text in error messages

#### Scenario: Blocked copy summary
- **WHEN** completeness reports fatal content loss
- **THEN** the shell shows a persistent error summary, leaves the clipboard unchanged, and does not display the success state

### Requirement: Width controls support canonical and custom capture
The toolbar SHALL expose the 430px Mobile preset and a validated custom-width input while preventing viewport mutation during an active conversion lease.

#### Scenario: Change custom width while idle
- **WHEN** the user enters a valid custom width while no conversion is running
- **THEN** the preview rebuilds or reflows at that width and the value is persisted

#### Scenario: Change width while copying
- **WHEN** the user attempts to change preset or custom width during conversion
- **THEN** the active snapshot remains unchanged and the control cannot mutate the leased preview

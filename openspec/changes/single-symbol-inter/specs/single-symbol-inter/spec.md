## ADDED Requirements

### Requirement: Single-symbol or single-emoji text uses Inter primary

When a text node's characters (trimmed) are exactly one non-letter, non-digit, non-CJK symbol/punctuation grapheme, or a single emoji/pictographic grapheme (including common VS16/ZWJ sequences treated as one emoji), the converter SHALL load Inter as the primary face and emit fontName.family Inter with weight-derived style.

#### Scenario: lone arrow

- **WHEN** text is `→`
- **THEN** fontName.family is Inter

#### Scenario: lone emoji

- **WHEN** text is `✅` with font-weight 700
- **THEN** fontName.family is Inter and style is Bold

### Requirement: System-stack non-symbol text uses Noto Sans SC primary

When text is not a single symbol/emoji and the CSS primary family is a system/generic/CJK stack keyword (e.g. system-ui, -apple-system, PingFang SC, Microsoft YaHei, sans-serif), the converter SHALL request Noto Sans SC at the CSS weight and emit fontName.family Noto Sans SC (via loader resolvedFamily / embedded name).

#### Scenario: system CJK body

- **WHEN** text is `下载APP` and font-family is system-ui / PingFang stack
- **THEN** primary request family is Noto Sans SC (not Inter)

### Requirement: Multi-character and explicit custom faces unchanged for Inter force

#### Scenario: multi-character with arrow

- **WHEN** text is `OK →`
- **THEN** primary is not forced to Inter solely due to the arrow

#### Scenario: explicit test/custom face

- **WHEN** text uses an explicit non-system family such as Open Sans
- **THEN** fontName.family remains that family (not forced to Inter)

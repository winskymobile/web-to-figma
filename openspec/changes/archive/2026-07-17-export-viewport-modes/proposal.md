## Why

Imported HTML may target several common mobile or desktop widths. A preview iframe that follows the browser window makes responsive layout and the resulting Figma frame nondeterministic, so the station needs an explicit logical viewport width.

## What Changes

- Add mutually exclusive device categories: Mobile and PC.
- Add common width presets for each category: Mobile `360/375/390/414`; PC `1280/1440/1512/1920`.
- Render the preview iframe at the selected logical CSS width and use the same width when creating the Figma root frame.
- Export the complete content height measured from the preview document.
- Persist the selected category and width in `localStorage`.
- Default to Mobile `375`.
- Remove the earlier experimental export-scale preference; preview and Figma geometry remain 1:1 CSS pixels.

## Capabilities

### New Capabilities

- `export-viewport`: User-selectable mobile/PC viewport presets drive preview reflow and Figma frame dimensions.

### Modified Capabilities

- (none)

## Impact

- `apps/web-to-figma` toolbar controls, preview stage sizing, viewport persistence, and copy dimensions.
- No changes to the published `@figit/dom-to-figma` API.
- No server-side conversion changes.

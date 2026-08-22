# Solo exploration note — AFTERSIGN runtime seam

## Observation
`aftersign/main.js` currently carries multiple responsibilities in one module:
- Story/state mutation (`choose`, `advance`, `deliverPacket`, `reloadFromSave`, `resetSliceSave`)
- Save I/O (`persist`, `persistAuthoritative`, `forceSave`)
- Published contract surface assembly (`publishState`, `window.__game` wiring)
- Input plumbing (packet gesture handlers, button handlers, keyboard handlers, pointer listeners)
- Rendering/animation tick (`tick`, camera/feedback envelopes, DOM sync)

This concentration makes review and regression isolation hard: copy/feel/save/input changes are tightly coupled in one file.

## Improvement candidate
File a refactor issue to split `aftersign/main.js` into focused runtime modules while preserving `window.__game` behavior and existing e2e contracts.
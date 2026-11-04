# Served tap baseline — 2026-11-04

## Scope

This record preserves current automated evidence for AFTERSIGN's player-facing tap path. It is not evidence of physical-device tactile behavior or drag-look behavior.

## Environment and command

- Snapshot: `774224b0d89b`
- Browser: Playwright Chromium
- Spec: `m-continue-visible-continuation.playtest.spec.ts`
- Command:

```sh
npm run test:e2e:aftersign -- m-continue-visible-continuation.playtest.spec.ts --workers=1 --repeat-each=3 --retries=0
```

## Result

The author recorded three passing Chromium repetitions with durations of 26.8s, 22.7s, and 24.9s (2.1 minutes total), and an existing Vite chunk-size warning. This document does not attach the Playwright output or other independently reviewable run artifact; the stated pass count and durations are therefore unverified within this PR.

This is a test-only record of rendered-UI tap coverage, not served-release evidence. It does not establish a physical phone baseline: no record currently identifies a device, served URL or SHA, date, and outcomes for the tap-to-talk, HUD-button, and touch move-pad controls. Keep tactile input changes frozen until that record exists.

## Boundary

Do not claim drag-look coverage from this run. The exercised spec covers the existing visible continuation flow; it does not establish a real drag-look input surface.

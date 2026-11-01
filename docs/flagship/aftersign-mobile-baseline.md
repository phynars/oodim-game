# AFTERSIGN mobile control baseline

## Scope

This is a release-recording policy for the intended player-facing mobile baseline:

- Tap-to-talk.
- HUD buttons.
- Touch move-pad outcomes.

This document does not add or verify an automated contract for those controls. Drag-look is out of scope: do not report it as tested or working until the product exposes a real drag-look input surface and that surface has its own test.

## Release evidence

For a future served-build verification, record the served URL, commit SHA, and final Playwright summary. A killed, backgrounded, or incomplete run is not release evidence. This document records no served run and supplies no release evidence.

## Interpretation

Browser emulation alone does not establish physical-device tactile quality. Keep physical-device touch-feel changes frozen until the evidence tracked by #2071 exists.

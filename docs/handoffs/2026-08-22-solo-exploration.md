# Solo exploration — 2026-08-22

## What I checked

- Current open GitHub issues.
- The flagship architecture entry point and standing brief.
- Repository TODO/FIXME/HACK markers.
- Runtime timing and input-listener call sites under `aftersign/`.

## Finding

`aftersign/main.js` contains both the served-game orchestration and the input-to-render latency path, with runtime call sites extending past line 3,470. The flagship brief makes a 60fps phone budget a product requirement; keeping frame-critical input, rendering, story, and feedback orchestration in one hot module makes that requirement harder to safely profile and change.

A refactor issue is filed to split the frame/input timing path behind a narrow runtime interface while preserving the served-page state contract.

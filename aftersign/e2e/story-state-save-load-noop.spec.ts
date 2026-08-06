// Intentionally empty: the misplaced `aftersign/tests/story-state-save-load.spec.js`
// (PR #1054) was removed in this same PR.
//
// Why the removal, not a rewrite:
//   1. `aftersign/playwright.config.ts` pins `testDir: "e2e"`, so any spec
//      under `aftersign/tests/` is never discovered by a runner — it gates
//      nothing, which defeats the harness premise.
//   2. The removed spec asserted `getStoryState` / `saveState` / `loadState`
//      on `window.__game`. The served surface (`aftersign/main.js`
//      `publishState()`) exposes `version, slug, scene, story, npcs, save,
//      input.choose, getSnapshot` — none of the three. Rewriting the spec
//      to assert the real durable-save API (`save.revision` + `authority`
//      via `input.forceSave` / `input.forceReload`) would duplicate
//      `aftersign/e2e/durable-save-load.spec.ts`, which already owns that
//      contract (currently `.skip`ped per its header rationale — cold-start
//      flake, paired red/green workflow retirement). Adding a second copy
//      just adds another place to update when the contract shifts.
//
// This file exists solely as a landing marker so the removal is
// self-documenting for the next reader who greps for `story-state-save-load`.
// Playwright is happy to load an empty spec module; no tests register, no
// lane time is spent.
export {};

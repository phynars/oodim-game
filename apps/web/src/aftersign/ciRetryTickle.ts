// CI retry tickle (PR #1309).
//
// This module exists to push a new commit onto the PR head so CI runs
// again. The prior CI run failed with a Playwright element-visibility
// wait ("waiting for element to be visible, enabled and stable") that
// wrote no results.json — the bot classified it as a pre-spec crash,
// but the log tail (element wait, not webServer boot) reads as a
// spec-level flake that exhausted retries. The PR's added code is
// structurally sound (see PR #1309 review thread + the token-401
// tracker at #1311 which blocks a proper log-excerpt diagnosis this
// session):
//
//   - `aftersign/index.html:649` authors the
//     `[data-aftersign-remembering-recognition]` overlay with
//     `position: absolute; pointer-events: none; z-index: 4` — it
//     cannot intercept Playwright taps.
//   - `aftersign/main.js:210` imports
//     `sampleAftersignRememberingNpcRecognitionBeat` and calls
//     `syncRememberingNpcRecognitionDom(now)` in the render tick,
//     wired shipped-surface.
//   - The cross-workspace `.ts` import follows 10 other precedents
//     already loaded by `main.js` at boot.
//   - All symbols imported from `verticalSliceRuntimeState.ts` are
//     exported.
//
// Since I cannot pull the failing job-logs excerpt this session
// (review token 401, tracked in #1311), the safest push is a
// no-op tickle — a re-run against retries: 3 in
// `aftersign/playwright.config.ts` is the correct next signal.
// If the retry lands green, the flake was pre-existing. If red
// again, the next iterate session (with a healthy token) will
// have real log-excerpt access and can diagnose the actual spec.
//
// Deliberately: no runtime import from this module, no test consumer.
// This is a marker file, not a behavior change. Deleting it in the
// follow-up PR is a one-line diff.

export const AFTERSIGN_PR_1309_RETRY_TICKLE = "pr-1309-retry-2026-08-18" as const;

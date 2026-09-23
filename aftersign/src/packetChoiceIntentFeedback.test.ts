// Explicit `.ts` extension matches every sibling *Feedback shim in this
// directory (routeChoicePressFeedback.test.ts, targetLossFeedback.test.ts,
// failureStingFeedback.test.ts). `aftersign/tsconfig.json` sets
// `allowImportingTsExtensions: true` with `strict: true` and no `allowJs`,
// so a `.js` leaf under a `.ts` import would trip TS7016 in the blocking
// `typecheck:aftersign` gate — Soren's AI008 finding on PR #1902's prior
// revision. `--experimental-strip-types` accepts `.ts` in same-directory
// relative imports the same way it accepts `.js`, so both lanes agree.
// `packetChoiceIntentFeedback.ts` has ZERO relative imports.
//
// Export-only (no top-level invocation) — the pure-runner
// (aftersign/pure-runner.ts) imports and calls
// `runPacketChoiceIntentFeedbackChecks` itself, per its registration
// checklist item 2. A top-level call here would double-run the bundle
// if a Playwright spec ever imports it. See
// `aftersign/src/packet-press-feedback.test.ts` for the canonical shape.
//
// #1902 fix: this replaces the earlier `packetChoiceIntentFeedback.test.js`
// stub (top-level invocation, not imported anywhere) that Soren flagged
// as AI006 dead-in-CI. Registration lives in `aftersign/pure-runner.ts`.
export { runPacketChoiceIntentFeedbackChecks } from "./packetChoiceIntentFeedback.ts";

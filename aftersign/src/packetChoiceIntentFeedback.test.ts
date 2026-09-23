// Explicit `.js` extension: Node's --experimental-strip-types (used by
// the `test:aftersign:pure` script) requires exact file paths on
// relative imports. `moduleResolution: "Bundler"` in
// aftersign/tsconfig.json accepts the `.js` suffix during typecheck,
// so both lanes agree. The pure-runner header note "Every relative
// specifier in this subgraph is extensioned (.ts/.js)" covers the
// same-directory `.js` leaf here — `packetChoiceIntentFeedback.js`
// has ZERO relative imports.
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
export { runPacketChoiceIntentFeedbackChecks } from "./packetChoiceIntentFeedback.js";

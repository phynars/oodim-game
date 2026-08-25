// Explicit `.ts` extension: Node's --experimental-strip-types (used by
// the `test:aftersign:pure` script) requires exact file paths on
// relative imports. `moduleResolution: "Bundler"` in
// aftersign/tsconfig.json accepts the `.ts` suffix during typecheck,
// so both lanes agree.
//
// Export-only (no top-level invocation) — the pure-runner
// (aftersign/pure-runner.ts) imports and calls runRouteRiskFeelChecks
// itself, per its registration checklist item 2. A top-level call here
// would double-run the bundle if a Playwright spec ever imports it.
// See `aftersign/src/packetIntent.test.ts` for the canonical shape.
export { runRouteRiskFeelChecks } from "./routeRiskFeel.ts";

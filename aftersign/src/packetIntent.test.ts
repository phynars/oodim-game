// Explicit `.ts` extension: Node's --experimental-strip-types (used by the
// `test:aftersign:pure` script) requires exact file paths on relative
// imports. `moduleResolution: "Bundler"` in aftersign/tsconfig.json accepts
// the `.ts` suffix during typecheck, so both lanes agree.
//
// Export-only (no top-level invocation) — the pure-runner
// (aftersign/pure-runner.ts) imports and calls runPacketIntentChecks
// itself. A top-level call here would double-run the bundle when the
// Playwright spec (packet-intent-contract.spec.ts) also imports it.
export { runPacketIntentChecks } from "./packetIntent.ts";

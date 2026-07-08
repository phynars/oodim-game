// aftersign — feel instrumentation surface for the flagship slice.
//
// Everything exported from here is safe to import from slice code and
// from the harness. Consumers wire `createInputLatencyProbe()` at the
// input entry point (pointerdown / keydown) and expose the probe on
// `window.__game.inputLatencyProbe` so the e2e feel lane can read it.
//
// See `inputLatencyProbe.test.ts` for the semantic contract.

export {
  createInputLatencyProbe,
  type InputLatencyProbe,
  type InputLatencySample,
} from "./inputLatencyProbe";

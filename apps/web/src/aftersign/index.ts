// aftersign — feel instrumentation surface for the flagship slice.
//
// Everything exported from here is safe to import from slice code and
// from the harness. Consumers wire `createInputLatencyProbe()` at the
// input entry point (pointerdown / keydown) and expose the probe on
// `window.__game.inputLatencyProbe` so the e2e feel lane can read it.
//
// LIFECYCLE: the probe owns an internal rAF loop. On unmount or HMR
// teardown you MUST call `probe.dispose()` — otherwise every reload
// stacks another orphaned loop that keeps ticking against a dead scope.
//
// See `inputLatencyProbe.test.ts` for the semantic contract.

export {
  createInputLatencyProbe,
  type InputLatencyProbe,
  type InputLatencySample,
} from "./inputLatencyProbe";

export {
  INTERACTION_CONFIRM_FEEL,
  sampleInteractionConfirmFeel,
  type InteractionConfirmSample,
} from "./interactionConfirmFeel";

export {
  createPacketIntentModel,
  type PacketIntentModel,
  type PacketIntentOptions,
  type PacketIntentSnapshot,
  type PacketSealIntent,
} from "./packetIntent";

export {
  getIoRecognitionLine,
  ioRecognitionLines,
  type IoPacketOutcome,
  type IoRecognitionFacts,
  type IoRecognitionLine,
  type IoReturnTone,
  type IoRouteAttention,
} from "./ioVoice";

export {
  getRecognitionFeedbackDuration,
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  toRecognitionMemoryBeatSnapshot,
  type RecognitionBeatKind,
  type RecognitionFeedbackOptions,
  type RecognitionFeedbackSample,
  type RecognitionMemoryBeatSnapshot,
  type RecognitionOutcome,
} from "./recognitionFeedback";

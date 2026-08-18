// AFTERSIGN vertical-slice story/state contract.
//
// Public compatibility surface for the first playable slice. Runtime state,
// durable save, recognition-beat wiring, and packet-interaction wiring are
// implemented in concern-focused sibling modules and re-exported here so
// existing imports from `./verticalSliceState` remain stable.

export {
  AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  recordAftersignOrraAction,
  recordAftersignReturnToneChoice,
  recordAftersignAskedForNextJob,
  recordAftersignNextJobRequest,
  confirmAftersignPacketChoice,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  resolveAftersignRememberingNpcDialogue,
  sampleAftersignRememberingNpcRecognitionEnvelope,
  type AftersignPacketChoiceConfirmBeat,
  type AftersignPacketChoiceConfirmFeel,
  type AftersignPacketOutcome,
  type AftersignOrraAction,
  type AftersignSceneId,
  type AftersignVerticalSliceState,
  type AftersignRememberingNpcId,
  type AftersignRememberingNpcDialogue,
  type AftersignRememberingNpcRecognitionFeel,
  type AftersignRememberingNpcRecognitionEnvelope,
  type AftersignRememberedTone,
} from "./verticalSliceRuntimeState";

export {
  createAftersignVerticalSliceSave,
  encodeAftersignDurableSave,
  decodeAftersignDurableSave,
  restoreAftersignVerticalSliceState,
  restoreAftersignDurableSave,
  type AftersignVerticalSliceSave,
  type AftersignDurableSaveEnvelope,
} from "./verticalSliceDurableSave";

export {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_ORRA_RECOGNITION_FEEL,
  sampleAftersignIoMemoryBeat,
  sampleAftersignOrraMemoryBeat,
  openAftersignIoRecognitionBeat,
  openAftersignOrraRecognitionBeat,
  sampleAftersignIoRecognitionEnvelope,
  sampleAftersignOrraRecognitionEnvelope,
  sampleAftersignOrraRecognitionForViewport,
  type AftersignIoRecognitionFeel,
  type AftersignOrraRecognitionFeel,
  type AftersignIoMemoryBeat,
  type AftersignOrraMemoryBeat,
  type AftersignIoRecognitionBeatOpen,
  type AftersignOrraRecognitionBeatCue,
  type AftersignOrraRecognitionEnvelope,
  type AftersignOrraRecognitionViewportEnvelope,
  type AftersignRecognitionViewport,
} from "./verticalSliceRecognitionBeat";

export {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  resolveAftersignPacketConfirmInteraction,
  resolveAndPlayAftersignPacketConfirmInteraction,
  playAftersignPacketConfirmInteractionFeel,
  sampleAftersignPacketConfirmInteractionEnvelope,
  type AftersignInteractionConfirmEnvelope,
  type AftersignInteractionConfirmKind,
  type AftersignPacketInteractionAction,
  type AftersignPacketConfirmInteraction,
  type AftersignPacketConfirmInteractionEffectsOptions,
} from "./verticalSlicePacketInteraction";

export {
  AFTERSIGN_FELT_RECOGNITION_BEAT,
  FELT_RECOGNITION_CLEANUP_TAIL_MS,
  resolveAftersignFeltRecognitionCue,
  createAftersignFeltRecognitionLayer,
  playAftersignFeltRecognitionBeat,
  resolveAndPlayAftersignFeltRecognitionBeat,
  type AftersignFeltRecognitionBeat,
  type AftersignRecognitionMemoryLine,
  type AftersignRecognitionCue,
  type AftersignFeltRecognitionPlayOptions,
  type AftersignFeltRecognitionHandle,
} from "./feltRecognitionBeat";

export {
  AFTERSIGN_KIOSK_SCENE_FEEL,
  sampleAftersignKioskSceneEnvelope,
  type AftersignKioskSceneEnvelope,
  type AftersignKioskSceneFeel,
} from "./kioskSceneFeel";

export {
  createAftersignWindowGameSurface,
  getAftersignStoryState,
  type AftersignStoryBeatId,
  type AftersignStoryStateOptions,
  type AftersignStoryStateSnapshot,
  type AftersignWindowGameSurface,
} from "./windowGameSurface";

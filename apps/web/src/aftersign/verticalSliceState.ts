// AFTERSIGN vertical-slice story/state contract.
//
// Public compatibility surface for the first playable slice. Runtime state,
// durable save, recognition-beat wiring, and packet-interaction wiring are
// implemented in concern-focused sibling modules and re-exported here so
// existing imports from `./verticalSliceState` remain stable.

export {
  AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
  confirmAftersignPacketChoice,
  meetIoForAftersignSlice,
  type AftersignPacketChoiceConfirmBeat,
  type AftersignPacketChoiceConfirmFeel,
  type AftersignPacketOutcome,
  type AftersignSceneId,
  type AftersignVerticalSliceState,
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
  sampleAftersignIoMemoryBeat,
  openAftersignIoRecognitionBeat,
  sampleAftersignIoRecognitionEnvelope,
  type AftersignIoRecognitionFeel,
  type AftersignIoMemoryBeat,
  type AftersignIoRecognitionBeatOpen,
} from "./verticalSliceRecognitionBeat";

export {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  resolveAftersignPacketConfirmInteraction,
  sampleAftersignPacketConfirmInteractionEnvelope,
  type AftersignInteractionConfirmEnvelope,
  type AftersignInteractionConfirmKind,
  type AftersignPacketInteractionAction,
  type AftersignPacketConfirmInteraction,
} from "./verticalSlicePacketInteraction";

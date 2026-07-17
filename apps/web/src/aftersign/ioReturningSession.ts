// AFTERSIGN returning-session copy lives in the shared package.
// Keep this web-facing module as a re-export only so the vertical-slice
// harness has one import surface without creating a third copy of Io's lines.

export {
  chooseIoReturningSessionLine,
  getIoReturningSessionLine,
  ioReturningSessionLines,
  type IoPacketOutcome,
  type IoReturnAnswerTone,
  type IoReturningSessionLineKey,
  type IoReturningSessionMemory,
  type IoRouteAttention,
} from "../../../../packages/aftersign/src/ioReturningSession";

// Io memory lines — thin re-export shim over io-recognition-beat.ts.
//
// There is exactly one source of truth for Io's voice: io-recognition-beat.ts.
// This file exists only so callers who want the returning-line surface can
// import from a name that reads like intent ("memory lines") without either
// (a) forking the copy or (b) inventing a parallel type system. If you need a
// new beat or a new returning-line variant, add it in io-recognition-beat.ts —
// do not fork.
export {
  authoredIoMemorySentence,
  buildIoAuthoredMemorySentence,
  isIoRecognitionBeatAllowed,
  selectIoRecognitionBeat,
  selectIoReturningLine,
  selectIoReturningMemoryLine,
  ioReturningMemoryLines,
  FIRST_PACKET_DELIVERY_ID,
  IO_OPENED_SEAL_LINE,
} from './io-recognition-beat.ts';

export type {
  IoMemoryLine,
  IoPacketChoice,
  IoPacketMemoryOutcome,
  IoPacketMemoryOutcome as PacketOutcome,
  IoRecognitionBeat,
  IoReturnTone,
  IoReturnTone as IoReturnAnswerTone,
  IoRouteAttention,
  IoSliceLine,
  IoSliceMemoryRecord,
  IoSliceMemoryRecord as IoMemoryRecord,
} from './io-recognition-beat.ts';

// Orra memory lines — thin re-export shim over orra-recognition-beat.ts.
//
// There is exactly one source of truth for Orra's voice: orra-recognition-beat.ts.
// This file exists only so callers who want the fact-driven memory-lines
// surface can import from a name that reads like intent ("memory lines")
// without either (a) forking the copy or (b) inventing a parallel token
// vocabulary. If you need a new beat, add it in orra-recognition-beat.ts —
// do not fork.

export {
  ORRA_RECOGNITION_BEATS,
  ORRA_RETURNING_BEATS as ORRA_MEMORY_LINES,
  selectOrraMemoryLines,
  selectOrraRecognitionBeat,
} from "./orra-recognition-beat";

export type {
  OrraDebtMemory,
  OrraMemoryReference,
  OrraPaceMemory,
  OrraRecognitionBeat,
  OrraRecognitionBeat as OrraMemoryLine,
  OrraRecognitionState,
  OrraSignalMemory,
} from "./orra-recognition-beat.ts";

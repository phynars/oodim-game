import {
  IO_RETURNING_SESSION_RECOGNITION,
  type IoReturningSessionOutcome,
} from "@aftersign/contracts";

export type IoRecognitionOutcome = IoReturningSessionOutcome;

export function resolveIoRecognitionDialogue(
  outcome: IoRecognitionOutcome,
): string {
  return IO_RETURNING_SESSION_RECOGNITION[outcome];
}

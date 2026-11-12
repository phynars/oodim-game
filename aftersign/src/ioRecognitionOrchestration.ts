import {
  buildIoRecognitionDialogueSnippets,
  selectIoRecognitionDialogueLine,
  type IoRecognitionDialogueInput,
  type IoRecognitionDialogueSnippet,
} from "./ioRecognitionDialogue.ts";

export type IoRecognitionOrchestrationInput = IoRecognitionDialogueInput;

/**
 * Owns construction and tier selection for the served return-recognition
 * dialogue. The composition root supplies durable player and packet state;
 * callers consume the single selected snippet rather than routing its tiers.
 */
export function selectIoRecognitionDialogue(
  input: IoRecognitionOrchestrationInput,
): IoRecognitionDialogueSnippet {
  const snippets = buildIoRecognitionDialogueSnippets(input);
  return selectIoRecognitionDialogueLine(snippets, { memory: input.memory });
}

export {
  buildIoRecognitionDialogueSnippets,
  selectIoRecognitionDialogueLine,
};

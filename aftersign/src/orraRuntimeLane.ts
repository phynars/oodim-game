import {
  ORRA_FIRST_CONTACT_LINE_ID,
  ORRA_RETURN_LINE_BY_ACTION,
  buildOrraRecognitionMemoryFact,
  orraRecognitionLineForMemory,
  type OrraDeliberateAction,
  type OrraRecognitionMemoryFact,
} from "./orraRecognitionMemory";

export { ORRA_FIRST_CONTACT_LINE_ID, ORRA_RETURN_LINE_BY_ACTION, buildOrraRecognitionMemoryFact };

export const ORRA_CHOICE_TO_ACTION = {
  "light-vigil": "lit",
  "spare-vigil": "spared",
} as const;

export type OrraChoiceId = keyof typeof ORRA_CHOICE_TO_ACTION;

export const ORRA_LINE_COPY_BY_ID: Record<string, string> = {
  [ORRA_FIRST_CONTACT_LINE_ID]: "The lantern is still warm. If you return with intention, I will remember.",
  [ORRA_RETURN_LINE_BY_ACTION.lit]: "You lit the vigil. I remember the light, and the hand that kept it alive.",
  [ORRA_RETURN_LINE_BY_ACTION.spared]: "You spared the vigil. I remember the mercy, and the weight you carried away.",
};

export const actionForOrraChoice = (choiceId: string): OrraDeliberateAction | null =>
  Object.prototype.hasOwnProperty.call(ORRA_CHOICE_TO_ACTION, choiceId)
    ? ORRA_CHOICE_TO_ACTION[choiceId as OrraChoiceId]
    : null;

const isOrraAction = (value: unknown): value is OrraDeliberateAction =>
  value === "lit" || value === "spared";

export const isOrraRecognitionMemoryFact = (value: unknown): value is OrraRecognitionMemoryFact => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const fact = value as { action?: unknown };
  return isOrraAction(fact.action);
};

// Durable saves are JSON; this coercion keeps only recognizable Orra
// memory facts so selectOrraRecognitionLine can safely read persisted
// payloads from localStorage/server without trusting raw shape.
export const coerceOrraRecognitionMemory = (value: unknown): OrraRecognitionMemoryFact[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isOrraRecognitionMemoryFact)
    .map((fact) => ({ ...fact }));
};

export const latestOrraRecognitionMemory = (
  memory: OrraRecognitionMemoryFact[],
): OrraRecognitionMemoryFact | null => (memory.length > 0 ? memory[memory.length - 1] : null);

// #1180 M-ORRA-E1 isolation invariant: this selector reads ONLY the
// Orra memory array handed in — it never touches Io state, and its
// return value is only ever assigned to `state.npcs.orra.{lastLine,
// lastLineId,lastLineMemoryRefs}` (see aftersign/main.js). No Orra
// path in this module writes a shared key Io reads; that's the code
// half of the guarantee flagship-surface-contract.spec.ts asserts
// end-to-end via the `orra-io-contamination` red mode.
export const selectOrraRecognitionLine = (memory: OrraRecognitionMemoryFact[]) =>
  orraRecognitionLineForMemory(latestOrraRecognitionMemory(memory));

export const lineCopyForOrraLineId = (lineId: string): string =>
  ORRA_LINE_COPY_BY_ID[lineId] ?? ORRA_LINE_COPY_BY_ID[ORRA_FIRST_CONTACT_LINE_ID];

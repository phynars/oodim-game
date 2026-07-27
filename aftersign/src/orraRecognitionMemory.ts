export const ORRA_MEMORY_KIND = "orra-recognition";

export const ORRA_FIRST_CONTACT_LINE_ID = "orra_first_contact";
export const ORRA_RETURN_LINE_BY_ACTION = {
  lit: "orra_return_lit_vigil",
  spared: "orra_return_spared_vigil",
} as const;

export type OrraDeliberateAction = keyof typeof ORRA_RETURN_LINE_BY_ACTION;

export type OrraRecognitionMemoryFact = {
  id: string;
  kind: typeof ORRA_MEMORY_KIND;
  npcId: "orra";
  subjectId: string;
  action: OrraDeliberateAction;
  sessionId: string;
  revision: number;
};

export type OrraRecognitionLine = {
  branch: "first-contact" | "recognition";
  lineId: typeof ORRA_FIRST_CONTACT_LINE_ID | (typeof ORRA_RETURN_LINE_BY_ACTION)[OrraDeliberateAction];
  memoryRef: string | null;
};

const VALID_ORRA_ACTIONS = new Set<OrraDeliberateAction>(["lit", "spared"]);

export function normalizeOrraAction(action: unknown): OrraDeliberateAction | null {
  return typeof action === "string" && VALID_ORRA_ACTIONS.has(action as OrraDeliberateAction)
    ? action as OrraDeliberateAction
    : null;
}

export function buildOrraRecognitionMemoryFact({
  playerId,
  action,
  sessionId,
  revision,
}: {
  playerId: string;
  action: OrraDeliberateAction;
  sessionId: string;
  revision: number;
}): OrraRecognitionMemoryFact {
  const normalizedAction = normalizeOrraAction(action);
  if (!normalizedAction) {
    throw new Error(`Unknown Orra action: ${String(action)}`);
  }
  const safePlayerId = playerId.trim() || "local-slice-player";
  const safeSessionId = sessionId.trim() || "local";
  const safeRevision = Math.max(1, Math.floor(revision));
  return {
    id: `orra:${safePlayerId}:${safeSessionId}:${normalizedAction}:r${safeRevision}`,
    kind: ORRA_MEMORY_KIND,
    npcId: "orra",
    subjectId: safePlayerId,
    action: normalizedAction,
    sessionId: safeSessionId,
    revision: safeRevision,
  };
}

export function orraRecognitionLineForMemory(
  memory: OrraRecognitionMemoryFact | null | undefined,
): OrraRecognitionLine {
  const action = normalizeOrraAction(memory?.action);
  if (!memory || memory.kind !== ORRA_MEMORY_KIND || memory.npcId !== "orra" || !action) {
    return {
      branch: "first-contact",
      lineId: ORRA_FIRST_CONTACT_LINE_ID,
      memoryRef: null,
    };
  }

  return {
    branch: "recognition",
    lineId: ORRA_RETURN_LINE_BY_ACTION[action],
    memoryRef: memory.id,
  };
}

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export function checkOrraRecognitionMemory() {
  const litMemory = buildOrraRecognitionMemoryFact({
    playerId: "p-7",
    action: "lit",
    sessionId: "s-1",
    revision: 2,
  });
  const sparedMemory = buildOrraRecognitionMemoryFact({
    playerId: "p-7",
    action: "spared",
    sessionId: "s-1",
    revision: 3,
  });

  assert(litMemory.kind === "orra-recognition", "Orra memory must use its own kind, not Io's");
  assert(litMemory.npcId === "orra", "Orra memory must be owned by Orra");
  assert(litMemory.id !== sparedMemory.id, "Different Orra actions must produce distinct durable ids");

  const firstContact = orraRecognitionLineForMemory(null);
  assert(firstContact.branch === "first-contact", "Missing Orra memory must stay on first-contact branch");
  assert(firstContact.lineId === ORRA_FIRST_CONTACT_LINE_ID, "First-contact line id must be stable");
  assert(firstContact.memoryRef === null, "First-contact line must not claim a memory ref");

  const litReturn = orraRecognitionLineForMemory(litMemory);
  assert(litReturn.branch === "recognition", "Valid Orra memory must select recognition branch");
  assert(litReturn.lineId === ORRA_RETURN_LINE_BY_ACTION.lit, "Lit action must map to lit recognition line");
  assert(litReturn.memoryRef === litMemory.id, "Recognition line must cite the Orra memory id");

  // Cross-kind guard: forge an Io-shaped memory by round-tripping through
  // `unknown` (a direct `as OrraRecognitionMemoryFact` cast off an object
  // literal whose `kind` widens to `string` is rejected under strict
  // `tsc --noEmit -p aftersign/tsconfig.json`, which is the exact step
  // that gates this PR). The selector must still refuse to fabricate
  // an Orra recognition from Io state.
  const ioShapedMemory = {
    ...litMemory,
    kind: "io-recognition",
  } as unknown as OrraRecognitionMemoryFact;
  assert(
    orraRecognitionLineForMemory(ioShapedMemory).branch === "first-contact",
    "Io-shaped memory must not trigger Orra recognition",
  );

  return true;
}

export function runOrraRecognitionMemoryChecks() {
  return checkOrraRecognitionMemory();
}

export type AftersignRouteAttention = "preserved-seal" | "opened-seal";

export interface AftersignStorySnapshot {
  currentBeatId: string;
  visitedBeatIds: string[];
  routeAttention: AftersignRouteAttention;
}

export interface AftersignNpcMemorySnapshot {
  referencedPlayerAction: AftersignRouteAttention;
  lastReferencedBeatId: string;
  line: string;
}

export interface AftersignNpcSnapshot {
  id: string;
  displayName: string;
  memory: AftersignNpcMemorySnapshot;
}

export interface AftersignGameHarnessSnapshot {
  story: AftersignStorySnapshot;
  npcs: {
    io: AftersignNpcSnapshot;
  };
  statePublishVersion: number;
}

export function assertAftersignStoryStateInvariants(snapshot: AftersignGameHarnessSnapshot): void {
  if (!Number.isFinite(snapshot.statePublishVersion) || snapshot.statePublishVersion <= 0) {
    throw new Error("window.__game snapshot must expose a positive statePublishVersion");
  }

  if (!snapshot.story.visitedBeatIds.includes(snapshot.story.currentBeatId)) {
    throw new Error("window.__game story.currentBeatId must be represented in story.visitedBeatIds");
  }

  const io = snapshot.npcs.io;
  if (io.id !== "io") {
    throw new Error(`expected Io NPC snapshot id to be io, got ${io.id}`);
  }

  if (io.memory.lastReferencedBeatId !== snapshot.story.currentBeatId) {
    throw new Error("Io memory lastReferencedBeatId must match the current story beat");
  }

  if (io.memory.referencedPlayerAction !== snapshot.story.routeAttention) {
    throw new Error("Io memory referencedPlayerAction must match story routeAttention");
  }

  assertIoMemoryLineReferencesAction(io.memory.line, io.memory.referencedPlayerAction);
}

function assertIoMemoryLineReferencesAction(line: string, action: AftersignRouteAttention): void {
  const normalizedLine = line.toLowerCase();

  if (action === "preserved-seal" && !hasAny(normalizedLine, ["kept", "preserved", "intact", "seal"])) {
    throw new Error("Io memory line must reference the preserved-seal player action");
  }

  if (action === "opened-seal" && !hasAny(normalizedLine, ["opened", "broke", "broken", "seal"])) {
    throw new Error("Io memory line must reference the opened-seal player action");
  }
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

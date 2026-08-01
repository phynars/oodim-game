import {
  buildIoReturnMemoryBeat,
  type IoPriorAction,
  type IoReturnMemoryBeat,
  type IoReturnMemoryInput,
} from "./ioReturnMemoryBeat";

export interface StoredIoReturnMemorySave {
  version: 1;
  playerId: string;
  displayName?: string;
  returningPlayer: boolean;
  priorActions: IoPriorAction[];
  trust: number;
  savedAtTurn: number;
}

export interface LoadedIoReturnMemoryState {
  input: IoReturnMemoryInput;
  beat: IoReturnMemoryBeat;
}

const VALID_PRIOR_ACTIONS: Record<IoPriorAction, true> = {
  "left-name": true,
  "crossed-threshold": true,
  "restored-signal": true,
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clampTrust(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}

function normalizePlayerId(playerId: string): string {
  const trimmed = playerId.trim();
  return trimmed.length > 0 ? trimmed : "anonymous-player";
}

function normalizeDisplayName(displayName: string | undefined): string | undefined {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isIoPriorAction(action: string): action is IoPriorAction {
  return action in VALID_PRIOR_ACTIONS;
}

function normalizePriorActions(priorActions: readonly string[]): IoPriorAction[] {
  const unique: IoPriorAction[] = [];
  for (const action of priorActions) {
    if (isIoPriorAction(action) && !unique.includes(action)) unique.push(action);
  }
  return unique;
}

export function encodeIoReturnMemorySave(
  input: IoReturnMemoryInput,
  savedAtTurn = 0,
): StoredIoReturnMemorySave {
  return {
    version: 1,
    playerId: normalizePlayerId(input.playerId),
    displayName: normalizeDisplayName(input.displayName),
    returningPlayer: input.returningPlayer,
    priorActions: normalizePriorActions(input.priorActions),
    trust: clampTrust(input.trust),
    savedAtTurn: Math.max(0, Math.trunc(savedAtTurn)),
  };
}

export function decodeIoReturnMemorySave(save: StoredIoReturnMemorySave): LoadedIoReturnMemoryState {
  const input: IoReturnMemoryInput = {
    playerId: normalizePlayerId(save.playerId),
    displayName: normalizeDisplayName(save.displayName),
    returningPlayer: save.returningPlayer,
    priorActions: normalizePriorActions(save.priorActions),
    trust: clampTrust(save.trust),
  };

  return {
    input,
    beat: buildIoReturnMemoryBeat(input),
  };
}

export function runIoReturnMemorySaveLoadChecks(): void {
  const saved = encodeIoReturnMemorySave(
    {
      playerId: " player-a ",
      displayName: " Io Friend ",
      returningPlayer: true,
      priorActions: ["left-name", "restored-signal", "left-name"],
      trust: 3,
    },
    4.7,
  );

  assert(saved.version === 1, "Io return-memory saves must carry an explicit version");
  assert(saved.playerId === "player-a", "Io return-memory saves must normalize player ids");
  assert(saved.displayName === "Io Friend", "Io return-memory saves must trim display names");
  assert(saved.savedAtTurn === 4, "Io return-memory saves must persist a stable integer turn");
  assert(saved.trust === 1, "Io return-memory saves must clamp trust into the authored range");
  assert(
    saved.priorActions.length === 2 &&
      saved.priorActions[0] === "left-name" &&
      saved.priorActions[1] === "restored-signal",
    "Io return-memory saves must de-dupe prior actions without reordering them",
  );

  const loaded = decodeIoReturnMemorySave(saved);
  assert(loaded.input.returningPlayer, "loaded Io saves must preserve the returning-player branch");
  assert(
    loaded.beat.rememberedAction === "restored-signal",
    "loaded Io saves must still surface the strongest persisted action",
  );
  assert(
    loaded.beat.line.includes("restored the signal"),
    "loaded Io saves must produce the authored line for the remembered action",
  );

  const sparse = decodeIoReturnMemorySave({
    version: 1,
    playerId: "   ",
    returningPlayer: true,
    priorActions: [],
    trust: Number.NaN,
    savedAtTurn: -2,
  });

  assert(
    sparse.input.playerId === "anonymous-player",
    "blank loaded player ids must collapse to a deterministic fallback",
  );
  assert(sparse.input.trust === 0, "non-finite loaded trust must collapse to neutral");
  assert(
    sparse.beat.returningPlayer && sparse.beat.rememberedAction === null,
    "sparse loaded returning saves must acknowledge return without inventing a memory",
  );
  assert(
    sparse.beat.nextPrompt === "ask-what-changed",
    "sparse loaded returning saves must continue into the returning-player prompt",
  );
}

// AFTERSIGN story/state contract — the typed surface a playwright harness spec
// or in-page inspector reads off `window.__game`. Mirrors
// docs/flagship/story-state-contract.md and is the reference the vertical-slice
// code will implement.
//
// This file exists in code (not just docs) so:
//   1. `npm run typecheck:aftersign` has real inputs (tsc otherwise errors
//      "No inputs were found" against an empty include).
//   2. When the slice's TypeScript scene lands, it can `import type` these
//      names — one source of truth for the harness contract.
//
// Ground truth for every field below is the pair (aftersign/index.html
// runtime, aftersign/e2e/*.spec.ts assertions). When they disagree with a
// prose doc, they win — the harness is what actually gates merges.

/** Story beats a scene can be paused at. Values match `state.scene.beat`
 * transitions in aftersign/index.html and the `waitForBeat` calls in
 * aftersign/e2e/*.spec.ts. */
export type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

/** The single memory-beat kind slice-1 emits. */
export type MemoryBeatKind = "io_packet_return";

/** Packet outcome carried on the memory beat. */
export type MemoryBeatOutcome = "sealed" | "opened";

/** Recognition line ids the runtime publishes on `story.memoryBeat.lineId`.
 * Must stay in sync with:
 *   - aftersign/index.html (`lineId: state.packet.sealed ? ... : ...`)
 *   - aftersign/e2e/io-recognition-memory-beat-contract.spec.ts
 *     (`ALLOWED_LINE_IDS`).
 * If either side changes, update this union in the same PR. */
export type IoRecognitionLineId =
  | "io-returning-recognition-sealed"
  | "io-returning-recognition-opened";

/** Story runtime payload for Io's first memory beat. */
export interface MemoryBeat {
  kind: MemoryBeatKind;
  outcome: MemoryBeatOutcome;
  startedAt: number;
  endedAt: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: IoRecognitionLineId;
}

/** Story state exposed for harness assertions. */
export interface StoryState {
  currentNpcId: string | null;
  memoryBeat: MemoryBeat | null;
}

/** A single fact remembered by an NPC. `sessionId` scopes prior-session recall
 * and is asserted by aftersign/e2e/memory-prior-session.spec.ts. */
export interface MemoryFact {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
}

/** State an NPC exposes to the harness — memory + the last line it spoke. */
export interface NpcState {
  memory: MemoryFact[];
  lastLine: string | null;
  /** IDs of memory facts that produced `lastLine`. Empty when the line is not
   * memory-driven. Non-empty proves the recognition beat is memory-backed
   * (see memory-prior-session.spec.ts, npc-memory-line-contract.spec.ts). */
  lastLineMemoryRefs: string[];
}

/** Choice IDs the scene's input surface accepts. Match the strings passed to
 * `game.input.choose(...)` in aftersign/e2e/*.spec.ts. */
export type ChoiceId = "open-packet" | "keep-packet-sealed" | "deliver-packet";

/** Input driver the harness uses instead of clicking DOM buttons. Keeps the
 * spec free of view-layer coupling. */
export interface InputSurface {
  choose(choiceId: ChoiceId): Promise<void>;
  advance(): Promise<void>;
  forceSave(): Promise<void>;
  forceReload(): Promise<void>;
}

/** Opaque snapshot of the harness surface — the exact shape returned by
 * `getSnapshot()` and accepted by `reset()`. Kept as `unknown` at the contract
 * boundary so specs can round-trip the value without depending on internal
 * fields the scene may extend over time. */
export type GameSnapshot = unknown;

/** Save metadata — revision monotonically increments on each persist; `dirty`
 * clears once the write has flushed. The harness awaits `dirty === false`
 * before triggering a reload to prove durability. */
export interface SaveState {
  revision: number;
  dirty: boolean;
}

/** The full harness surface. `version: 1` gates all assertions — bumping this
 * is the explicit signal that the contract has evolved and specs must adapt. */
export interface GameSurface {
  version: 1;
  scene: { beat: Beat };
  story: StoryState;
  npcs: {
    io: NpcState;
  };
  save: SaveState;
  input: InputSurface;
  /** Deep-clone snapshot of the current story/state surface. Round-trips
   * through `reset(snapshot)` to restore the exact beat + memory. */
  getSnapshot(): GameSnapshot;
  /** Restore the scene from a snapshot produced by `getSnapshot()`. With no
   * argument, resets the slice save to first-run defaults. */
  reset(snapshot?: GameSnapshot): Promise<void> | void;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    __game?: GameSurface;
  }
}

export {};

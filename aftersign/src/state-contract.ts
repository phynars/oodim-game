// AFTERSIGN story/state contract — the typed surface a playwright harness spec
// or in-page inspector reads off `window.__game`. Mirrors
// e2e-shared/flagship-story-state-contract.md and is the reference the
// vertical-slice code will implement.
//
// This file exists in code (not just docs) so:
//   1. `npm run typecheck:aftersign` has real inputs (tsc otherwise errors
//      "No inputs were found" against an empty include).
//   2. When the slice's TypeScript scene lands, it can `import type` these
//      names — one source of truth for the harness contract.
//
// The current aftersign/index.html is a standalone ES-module preview and does
// NOT yet expose window.__game.version === 1 or the input helpers below. That
// gap is intentional: the failing-first e2e spec (memory-prior-session.spec.ts)
// asserts against this shape and MUST go red in CI until the scene code is
// wired up. See docs/flagship/story-state-contract.md.

/** Story beats a scene can be paused at. Extend as the slice grows. */
export type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

/** A single fact remembered by an NPC. `sessionId` scopes prior-session recall. */
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
  /** IDs of memory facts that produced `lastLine`. Empty when line is not
   * memory-driven. Non-empty proves the recognition beat is memory-backed. */
  lastLineMemoryRefs: string[];
}

/** Choice IDs the scene's input surface accepts. */
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

/** Outcome the player produced on the packet: kept sealed, or opened it.
 * Mirrored on `RecognitionFeedbackMemoryBeat` in recognitionFeedback.ts —
 * this contract copy is kept structural so the harness can assert without
 * importing the runtime module. */
export type RecognitionOutcome = "sealed" | "opened";

/** The memoryBeat frame Io publishes at the end of the 1220ms recognition
 * beat (see docs/flagship/io-recognition-beat.md). Shape matches
 * `RecognitionFeedbackMemoryBeat`; kept here so `window.__game.story` is
 * fully typed at the contract boundary. */
export interface RecognitionMemoryBeat {
  readonly kind: "io_packet_return";
  readonly outcome: RecognitionOutcome;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly cameraDeltaMeters: number;
  readonly cameraYawDegrees: number;
  readonly inputLockMs: number;
  readonly lineId: string;
}

/** Story-level surface published alongside scene/npcs/save. The harness reads
 * `story.memoryBeat` to assert the Io recognition contract fired, and
 * `story.currentNpcId` to identify which character owns the current beat.
 * Both are optional so pre-beat frames pass typecheck. */
export interface StoryState {
  currentNpcId?: string;
  memoryBeat?: RecognitionMemoryBeat;
}

/** The full harness surface. `version: 1` gates all assertions — bumping this
 * is the explicit signal that the contract has evolved and specs must adapt. */
export interface GameSurface {
  version: 1;
  scene: { beat: Beat };
  npcs: {
    io: NpcState;
  };
  save: SaveState;
  /** Story-level surface (currentNpcId + memoryBeat). The harness reads
   * `story.memoryBeat` to assert the Io recognition contract fired. */
  story: StoryState;
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

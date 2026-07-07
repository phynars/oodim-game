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
// aftersign/index.html publishes this surface (window.__game.version === 1,
// scene.beat, npcs.io, save, input helpers) and the e2e spec
// (memory-prior-session.spec.ts) is un-skipped and gates the aftersign CI
// lane. See docs/flagship/story-state-contract.md.

/** Story beats a scene can be paused at. Extend as the slice grows. */
export type Beat =
  | "arrival"
  | "arrive-at-kiosk"
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
  npcs: {
    io: NpcState;
  };
  save: SaveState;
  input: InputSurface;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    __game?: GameSurface;
  }
}

export {};

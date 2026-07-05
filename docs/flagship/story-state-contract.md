# AFTERSIGN story-state contract

**Owner:** Soren Vask  
**Product owner:** Mara Okonkwo  
**Status:** Slice 1 implementation contract  
**Applies to:** `window.__game` for the AFTERSIGN vertical slice

## Purpose

The first flagship slice must prove one thing in a way the harness can fail: Io remembers the player's prior packet outcome because the server-authoritative save says so, not because the current browser session invented it.

This contract deliberately covers one scene, one NPC, and one memory fork. It is not a general simulation API.

## Product promise under test

A returning player reaches Io's Night Post kiosk and hears a line that correctly references the previous session's sealed-packet outcome:

- sealed packet preserved: Io may reference the unbroken blue seal;
- packet opened: Io may reference the broken seal;
- no prior packet outcome: Io must not pretend to remember one.

The test surface exists to let Playwright inspect and drive that story proof without depending on pixels, timing sleeps, or private engine internals.

## Exposure rules

`window.__game` is present only in development and harness builds. It must be plain JSON-compatible state plus a small async input API. The state mirrors authored story state; it must not expose arbitrary database rows, secrets, raw prompts, or implementation-only caches.

The game may keep richer internal state, but the harness contract below is the only stable surface tests should rely on for slice 1.

## Minimal shape

```ts
type AftersignGameTestSurface = {
  version: 1;
  scene: {
    id: 'io-night-post';
    act: 'act-1';
    beat:
      | 'arrival'
      | 'packet-offered'
      | 'packet-choice-made'
      | 'packet-delivered'
      | 'io-return-recognition';
  };
  player: {
    durableId: string | null;
    sessionId: string;
  };
  delivery: {
    id: 'blue-packet-001';
    outcome: 'unknown' | 'sealed' | 'opened' | 'withheld' | 'returned';
    completed: boolean;
  };
  io: {
    id: 'io-vale';
    present: boolean;
    trustPosture: 'untested' | 'wary' | 'trusted';
    lastAuthoredMemorySentence: string | null;
    lastLine: string | null;
    lastLineMemoryRefs: string[];
  };
  save: {
    authority: 'server' | 'local-fallback';
    slot: 'default';
    revision: number;
    lastSeenBucket: 'first-session' | 'same-day-return' | 'later-return' | null;
    lastPersistedAt: string | null;
    roundTripToken: string | null;
    dirty: boolean;
  };
  input: {
    choosePacketOutcome(outcome: 'sealed' | 'opened'): Promise<void>;
    deliverPacket(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
    resetHarnessPlayer(): Promise<void>;
  };
};
```

## Field rules

### `version`

Always `1` for this contract. Any breaking shape change increments the version and updates the harness in the same PR.

### `scene`

Read-only mirror of the authored scene. Harness code may wait for `scene.beat` to reach a named value, but must not mutate it directly.

### `player`

- `durableId` is the stable server-recognized player identity for the current save. It may be `null` only before identity bootstrap completes.
- `sessionId` changes on reload/new browser context and lets the harness distinguish first-session and returning-session behavior.

Both fields are read-only mirrors.

### `delivery`

Read-only mirror of the slice delivery state.

- `unknown`: no authored packet outcome has been committed.
- `sealed`: the player chose to preserve the seal.
- `opened`: the player chose to break the seal.
- `withheld` and `returned`: reserved for concept parity, but not required as playable branches in slice 1 unless explicitly implemented.

The harness sets this only through `input.choosePacketOutcome(...)`, never by assigning the object directly.

### `io`

Read-only mirror of Io's authored memory state.

- `trustPosture` is the slice-sized social consequence of the packet outcome.
- `lastAuthoredMemorySentence` is the single persisted sentence Io is allowed to use on return.
- `lastLine` is the latest surfaced Io line.
- `lastLineMemoryRefs` contains stable ids for memories used by `lastLine`.

For slice 1, valid memory refs are:

- `blue-packet-001:sealed`
- `blue-packet-001:opened`

If `lastLine` references the packet outcome, `lastLineMemoryRefs` must contain exactly the matching id and must not contain the opposite id.

### `save`

Read-only mirror of persistence state.

- `authority: 'server'` means the last loaded state came from the server-authoritative save path.
- `authority: 'local-fallback'` is allowed only for offline/dev fallback and must fail the server-backed memory harness.
- `revision` increments after a successful server save.
- `roundTripToken` is an opaque value supplied by the server on save/load. It must change or be revalidated across `forceSave()` + `forceReload()` so the harness can prove a real persistence round trip occurred.
- `dirty` is true when local authored state has not yet been persisted.

The harness must treat `localStorage` as hostile. A test may clear or poison local storage between `forceSave()` and `forceReload()`; the returning memory still passes only if `authority === 'server'`, `revision` survives, and the correct Io memory ref is present.

## Harness-writable actions

The only writable surface is `input`.

### `choosePacketOutcome(outcome)`

Moves the scene from `packet-offered` toward `packet-choice-made` and records the player's authored choice. It must reject any value except `sealed` or `opened` in slice 1.

### `deliverPacket()`

Completes the delivery and makes the selected packet outcome eligible for persistence. It should not silently invent a packet outcome if none was chosen.

### `forceSave()`

Flushes the current authored state to the server-authoritative save path. It resolves only after `save.dirty === false`, `save.authority === 'server'`, and `save.revision` reflects the write.

### `forceReload()`

Reloads story state through the same path a returning player uses. It must not preserve memory solely by retaining in-memory JavaScript objects.

### `resetHarnessPlayer()`

Creates a clean durable player identity for deterministic tests. This is harness-only and must not be reachable in public production play.

## Required slice 1 assertions

### 1. Sealed packet memory round trip

1. Reset harness player.
2. Wait for `scene.beat === 'packet-offered'`.
3. Call `choosePacketOutcome('sealed')`.
4. Call `deliverPacket()`.
5. Call `forceSave()` and record `player.durableId`, `save.revision`, and `save.roundTripToken`.
6. Clear or poison local storage.
7. Call `forceReload()`.
8. Assert:
   - same non-null `player.durableId`;
   - `save.authority === 'server'`;
   - `save.revision` is at least the recorded revision;
   - `delivery.outcome === 'sealed'`;
   - `io.lastLineMemoryRefs` contains `blue-packet-001:sealed`;
   - `io.lastLineMemoryRefs` does not contain `blue-packet-001:opened`;
   - `io.lastLine` or `io.lastAuthoredMemorySentence` references the seal as intact/whole/unbroken by authored copy rule.

### 2. Opened packet memory round trip

Same flow as above, but choose `opened` and assert:

- `delivery.outcome === 'opened'`;
- `io.lastLineMemoryRefs` contains `blue-packet-001:opened`;
- `io.lastLineMemoryRefs` does not contain `blue-packet-001:sealed`;
- `io.lastLine` or `io.lastAuthoredMemorySentence` references the seal as broken/opened by authored copy rule.

### 3. No false memory on first session

With a clean harness player before any delivery is completed, Io must not expose `blue-packet-001:sealed` or `blue-packet-001:opened` in `lastLineMemoryRefs`.

### 4. Local-only fakery fails

After poisoning local storage with an opposite packet outcome, reloading must still surface the server outcome. If the implementation reports `authority: 'local-fallback'` or references the poisoned outcome, the test fails.

## Broken-mode requirement

The implementation should include at least one deterministic broken mode for red-polarity CI. Minimum acceptable modes:

- `FLAGSHIP_BREAK_MODE=drop-memory`: save succeeds but Io memory is omitted on reload;
- `FLAGSHIP_BREAK_MODE=wrong-memory-ref`: Io references the opposite packet outcome;
- `FLAGSHIP_BREAK_MODE=local-only-save`: reload succeeds only while local storage remains intact.

The matching red test must fail when the broken mode is active and must fail the build if the broken mode accidentally passes.

## Scope guard

Do not add a general NPC memory graph for slice 1. Do not expose prompt transcripts. Do not require visual assertions to prove this contract. Visual, audio, and juice timing can layer on top after the story-state proof is stable.

This contract is complete when the harness can say, with no ambiguity: the same player returned, the server remembered what happened to the blue packet, and Io said the line that belongs to that memory.

# AFTERSIGN story-state contract

> **DRIFT WARNING — reconcile before implementing.** This document
> describes an aspirational `window.__game` contract that has NOT been
> reconciled against the live runtime. The runtime at
> `aftersign/index.html` still publishes the three.js-backed surface
> (`version: 1`, `story.memoryBeat`, `input.choose`, `getSnapshot`,
> the packet-intent controller). Names like `storyState`, `inputState`,
> `choosePacketOutcome`, `loadMemory`, `startReturnSession`,
> `resetSlice` do **not** exist in the shipped runtime at this commit
> — treat any prior claim that they replaced this contract as
> unverified. **Source of truth for the live runtime surface:
> `aftersign/index.html`** (and the e2e specs in `aftersign/e2e/`
> that assert against it). Issue #634 carries `agent-needs-human` —
> a human should decide whether this contract or the runtime is the
> intended shape before further work here.

**Status:** slice-1 harness contract
**Owner:** Soren Vask
**Related:** `docs/flagship/BRIEF.md`, `docs/flagship/concept.md`, issue #394

## Purpose

The vertical slice proves one thing: a player returns, and Io says a line that is correct because of a server-backed memory of the prior packet outcome.

This document defines the smallest `window.__game` surface the WebGL-headless harness may rely on for that proof. It is a test contract, not a gameplay architecture. Gameplay code can organize itself however it wants internally, but the browser page must expose this plain serializable surface in test builds.

## Non-negotiable invariants

1. Every story beat visible to the harness has a stable id.
2. Every remembered Io line references a concrete prior memory id.
3. The returned memory must be loaded from the authoritative save path, not reconstructed from local-only browser state.
4. Harness input waits for quiescent story state, not pixels, animation timing, or fixed sleeps.
5. Slice 1 contains one scene, one remembering NPC, one delivery, and one durable proof.

## Public surface

`window.__game` must exist before the first harness assertion resolves.

```ts
type FlagshipGameSurface = {
  version: 1;
  build: {
    slug: 'aftersign';
    mode: 'test' | 'dev' | 'prod';
  };
  scene: {
    id: 'io-night-post-kiosk';
    act: 'act-1-seal';
    beat:
      | 'arrival'
      | 'packet-offered'
      | 'packet-choice'
      | 'packet-delivered'
      | 'io-return-recognition';
    ready: boolean;
  };
  player: {
    id: string;
    name: string | null;
    flags: Record<string, boolean | number | string>;
  };
  delivery: {
    id: 'blue-packet';
    outcome: 'unknown' | 'sealed' | 'opened' | 'withheld' | 'returned';
  };
  npcs: {
    io: {
      id: 'io';
      displayName: 'Io Vale';
      present: boolean;
      trustPosture: 'untested' | 'trusted-seal' | 'useful-breach';
      memories: Array<{
        id: string;
        kind: 'delivery-outcome' | 'return' | 'route-attention' | 'answer-tone';
        subject: 'player';
        predicate: string;
        object: string;
        deliveryId?: 'blue-packet';
        sessionId: string;
        source: 'server';
      }>;
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    slot: 'default';
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
    authority: 'server' | 'local-fallback';
    lastLoadProof: {
      source: 'server' | 'local-fallback' | null;
      revision: number | null;
      playerId: string | null;
    };
  };
  input: {
    choose(choiceId: 'keep-sealed' | 'open-packet' | 'deliver-packet' | 'return-to-io'): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(options?: { clearLocalState?: boolean }): Promise<void>;
    waitForStoryIdle(): Promise<void>;
  };
};
```

## Field rules

### `scene`

`scene.ready` means the story surface is stable enough for a harness read. It does not mean all rendering, audio, or animation has finished.

The harness may assert exact `scene.beat` values. These ids are deliberately authored and small; do not derive them from dialogue text.

### `player`

`player.id` is the durable player identity used by the authoritative save path. It must survive a reload with `clearLocalState: true` when the same test identity is supplied by the harness environment.

`player.flags` is for authored story flags only. It must not become a dump of engine internals.

Allowed slice-1 flags:

- `io_intro_seen: boolean`
- `io_route_listened: boolean`
- `returned_after_first_session: boolean`
- `answer_tone: 'kind' | 'evasive' | 'blunt' | 'unset'`

### `delivery`

`delivery.outcome` is the canonical packet outcome for Io's first memory beat.

For slice 1, the harness needs only two returning-session branches:

- `sealed` — player delivered the blue packet unopened.
- `opened` — player broke the seal before delivery.

The other enum members reserve authored room without expanding the first harness proof.

### `npcs.io.memories`

Io memory entries are read-only mirrors of authoritative state. The harness may read them but must not mutate them directly.

The first slice requires exactly one delivery-outcome memory after the first session is saved:

```ts
{
  id: 'io-remembers-blue-packet-sealed' | 'io-remembers-blue-packet-opened';
  kind: 'delivery-outcome';
  subject: 'player';
  predicate: 'delivered';
  object: 'blue-packet-sealed' | 'blue-packet-opened';
  deliveryId: 'blue-packet';
  sessionId: string;
  source: 'server';
}
```

The authored memory sentence is represented by Io's returning line plus `lastLineMemoryRefs`. The harness asserts the reference id, not just the English text.

### `npcs.io.lastLineMemoryRefs`

Every returning-session Io line that claims memory must list the memory ids it used.

Required mappings:

| Prior outcome | Required memory id | Required line fragment |
| --- | --- | --- |
| `sealed` | `io-remembers-blue-packet-sealed` | `blue seal, unbroken` |
| `opened` | `io-remembers-blue-packet-opened` | `The seal did not` |

The fragment check catches a swapped or generic line. The memory-ref check catches a line that happens to contain the right words but was not tied to the saved memory.

### `save`

`save.authority` must be `server` for the vertical-slice durable proof. `local-fallback` may exist only for degraded development runs and must fail the durable harness.

`save.lastLoadProof` is the harness-visible evidence that a reload used the authoritative path. After `forceReload({ clearLocalState: true })`, the durable harness expects:

- `lastLoadProof.source === 'server'`
- `lastLoadProof.revision === save.revision`
- `lastLoadProof.playerId === player.id`
- `save.dirty === false`

A localStorage-only implementation cannot satisfy this after local state is cleared.

## Harness-writeable controls

Only `input` is harness-writeable. All story fields are read-only observations.

The harness may drive these choices:

1. `keep-sealed` — mark intent to preserve the packet seal.
2. `open-packet` — mark intent to break the seal.
3. `deliver-packet` — complete the delivery and write the delivery outcome.
4. `return-to-io` — advance to Io's recognition beat after reload.

The implementation may expose richer player controls later. The harness contract starts with authored intent primitives because the slice proof is story correctness, not movement fidelity.

## Required tests

### 1. Story-state invariant test

Drive a first-session sealed delivery:

1. Wait for `window.__game.version === 1` and `scene.ready === true`.
2. Assert initial beat is `arrival` or `packet-offered`.
3. Call `choose('keep-sealed')`, then `choose('deliver-packet')`.
4. Assert:
   - `delivery.outcome === 'sealed'`
   - `scene.beat === 'packet-delivered'`
   - `player.flags.io_intro_seen === true`
   - `npcs.io.trustPosture === 'trusted-seal'`

### 2. NPC-memory round-trip test

Use the same durable player identity across two sessions:

1. Session A: deliver the blue packet sealed and `forceSave()`.
2. Session B: `forceReload({ clearLocalState: true })`, then `choose('return-to-io')`.
3. Assert:
   - Io has memory id `io-remembers-blue-packet-sealed`.
   - That memory has `source === 'server'`.
   - `npcs.io.lastLine` contains `blue seal, unbroken`.
   - `npcs.io.lastLineMemoryRefs` contains `io-remembers-blue-packet-sealed`.
   - `save.lastLoadProof.source === 'server'`.

Repeat with `open-packet` and require `io-remembers-blue-packet-opened` plus the `The seal did not` line fragment.

### 3. Durable save/load test

1. Mutate one story flag through harness input.
2. Create one Io delivery-outcome memory through harness input.
3. Call `forceSave()`.
4. Capture `save.revision`.
5. Call `forceReload({ clearLocalState: true })`.
6. Assert:
   - revision survived or advanced monotonically;
   - story flag survived;
   - Io memory survived;
   - `player.id` survived;
   - `save.authority === 'server'`;
   - `save.lastLoadProof.source === 'server'`.

## Required red polarity

The first implementation PR for this contract must include at least one deliberately broken mode that makes the relevant test fail. Acceptable break modes:

- `FLAGSHIP_BREAK_MODE=drop-memory` — save/load succeeds but Io memory is absent after reload.
- `FLAGSHIP_BREAK_MODE=wrong-io-line` — Io loads the sealed memory but speaks the opened line, or the reverse.
- `FLAGSHIP_BREAK_MODE=local-only-save` — state survives normal reload but fails after `clearLocalState: true`.

CI should run both the normal green path and a red-polarity check that proves the broken mode does not pass accidentally.

## Explicit non-goals

- No pixel diffs.
- No camera, haptic, audio, lighting, or postprocessing assertions.
- No generated asset checks.
- No broad NPC simulation.
- No AI transcript judging.
- No city-wide episode persistence model.
- No movement-feel gates.

Those are real gates, but they are not the first story/state contract.

## Definition of done for slice-1 harness wiring

- `window.__game.version === 1` is visible under Playwright.
- The sealed and opened Io recognition branches are both testable.
- A wrong Io returning line fails at least one assertion.
- A local-only save fails the durable proof after local state is cleared.
- Tests wait on `waitForStoryIdle()` or equivalent state quiescence, never fixed sleeps.

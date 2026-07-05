# Story/state harness contract

Status: proposed harness slice
Owner: Soren Vask
Source mandate: `docs/flagship/BRIEF.md`

## Purpose

The flagship is story-first. A story beat is not real until the headless harness can assert it through a stable runtime contract.

This slice defines the smallest `window.__game` surface needed before gameplay code begins:

1. story/state invariants;
2. NPC-memory round-trips;
3. durable save/load continuity.

The contract is intentionally narrow. It should be easy for the first vertical-slice scene to satisfy and hard for later work to bypass.

## Runtime surface

Expose one browser-global object in flagship scenes:

```ts
type FlagshipHarnessSurface = {
  story: {
    sceneId: string;
    beatId: string;
    completedBeatIds: string[];
  };
  player: {
    id: string;
    displayName?: string;
  };
  npcMemory: {
    npcId: string;
    knownPlayerId: string;
    rememberedFacts: Array<{
      id: string;
      subject: string;
      predicate: string;
      object: string;
      sourceBeatId: string;
    }>;
    lastUtterance?: string;
  }[];
  save: {
    slotId: string;
    revision: number;
    lastSavedAt: string;
    restoredFromRevision?: number;
  };
};

declare global {
  interface Window {
    __game?: FlagshipHarnessSurface;
  }
}
```

## Required failing-first tests

The first harness PR should add tests before implementation exists. They should fail for missing `window.__game`, then pass only when the flagship scene publishes the contract.

### 1. Story invariant

A headless browser loads the vertical-slice route and asserts:

- `window.__game` exists;
- `story.sceneId` is stable and non-empty;
- `story.beatId` is stable and non-empty;
- `story.completedBeatIds` includes the current beat only after the player completes the beat trigger;
- no completed beat is duplicated.

### 2. NPC-memory round-trip

A headless browser performs two sessions with the same durable player identity:

Session A:

- enter the scene;
- perform one named action that should become an NPC memory fact;
- wait for save acknowledgement;
- capture `player.id`, `story.beatId`, and the new fact id.

Session B:

- reload with the same identity;
- assert the same NPC exposes a remembered fact whose `sourceBeatId` matches Session A;
- assert `lastUtterance` references the remembered fact in player-visible text.

### 3. Durable save/load

A headless browser mutates state, reloads, and asserts:

- `save.revision` increases after the mutation;
- the reload reports `save.restoredFromRevision` equal to the prior saved revision;
- story completion and NPC memory survive reload;
- a fresh player identity does not inherit the prior player's memory.

## Non-goals

- Do not test prose quality here. The harness only proves that remembered facts surface in text.
- Do not freeze the full narrative schema. This is the minimum contract for slice one.
- Do not require the final AI-memory backend for the first red test. A deterministic local/server stub is acceptable until the durable backend lands.

## Acceptance check

Done means a PR adds a headless failing-first test file for the flagship route that asserts this contract, plus the smallest runtime shim needed to make the test pass. The test must fail if `window.__game` is removed, if the remembered fact is not restored across sessions, or if save revision does not survive reload.

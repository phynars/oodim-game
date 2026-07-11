# AFTERSIGN story/state harness contract

This is the first merge-gate shape for the flagship vertical slice. It exists before gameplay code so the slice can be built toward a failing test, not explained after the fact.

Refs #391.

## Purpose

The vertical slice is only real when a headless WebGL run can prove three things:

1. the story state exposed through `window.__game` changed because of a player action;
2. Io references the correct prior packet outcome on a later session;
3. the remembered fact survives a forced save and reload keyed to the same durable player identity.

The harness should not inspect pixels, wait on wall-clock sleeps, or infer narrative state from DOM text alone. Narrative state is a first-class test surface.

## Minimal public test surface

The flagship route must expose this serializable object in Playwright:

```ts
type FlagshipTestSurface = {
  version: 1;
  scene: {
    id: "io-kiosk";
    act: "the-seal";
    beat:
      | "arrival"
      | "packet-offered"
      | "packet-opened"
      | "packet-kept-sealed"
      | "packet-delivered"
      | "io-returning-recognition";
  };
  player: {
    id: string;
    name: string | null;
    flags: Record<string, boolean | number | string>;
  };
  npcs: {
    io: {
      id: "io";
      displayName: "Io Vale";
      present: boolean;
      trust: number;
      memory: Array<{
        id: string;
        subject: "player";
        predicate: string;
        object: string;
        sessionId: string;
      }>;
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    slot: string;
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
  };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};
```

Only test-safe methods belong under `input`. Production code may use richer internals, but the harness contract stays small and stable.

## Required deterministic assertions

### 1. Story beat and flag transition

Starting from a fresh player identity:

1. wait until `window.__game.version === 1`;
2. assert `scene.beat === "packet-offered"`;
3. call `window.__game.input.choose("keep-packet-sealed")`;
4. wait for a quiesced state where `scene.beat === "packet-choice"` and `packet.sealed === true`;
5. assert `player.flags.packetSealed === true`;
6. assert `player.flags.packetOpened !== true`.

A sibling path must cover `choose("open-packet")`, wait for `scene.beat === "packet-choice"` and `packet.sealed === false`, and assert the opposite flags. The unified `packet-choice` beat is branched on `packet.sealed`; earlier revisions of this contract split it into `packet-kept-sealed` / `packet-opened`, but the runtime and harness collapsed them into a single beat that keys the branch off the packet-sealed flag.

### 2. Io memory round-trip

Using the same durable player identity across a forced reload:

1. choose either `keep-packet-sealed` or `open-packet`;
2. deliver the packet;
3. force save;
4. force reload;
5. advance until Io's `io-return-recognition` beat;
6. assert `npcs.io.memory` contains exactly one packet-outcome fact for the current session lineage;
7. assert `npcs.io.lastLineMemoryRefs` contains that fact id;
8. assert the referenced fact object matches the packet outcome.

The test must fail if Io says the sealed line after the opened path, or the opened line after the sealed path. Matching only the English line is insufficient; the line must point back to the memory id.

### 3. Durable save/load

For one test-controlled save slot:

1. mutate one story flag and one Io memory fact through public input;
2. record `save.revision`;
3. call `forceSave()`;
4. assert `save.dirty === false` and `save.revision > previousRevision`;
5. call `forceReload()`;
6. assert the scene beat, player flags, Io memory, and save revision survive reload.

A local-storage-only implementation must not satisfy this test. The saved state must be keyed to the durable player identity used by the server-backed slice.

## Red-polarity fixtures

At least one deliberately broken mode must exist so the harness proves it can go red. Acceptable first modes:

- `FLAGSHIP_BREAK_MODE=drop-memory` removes Io's packet-outcome memory before reload;
- `FLAGSHIP_BREAK_MODE=skip-save` acknowledges `forceSave()` without persisting the changed flag or memory;
- `FLAGSHIP_BREAK_MODE=stale-beat` leaves `scene.beat` behind after a player choice.

CI should run the normal suite green, then run an inverted red-polarity command against one broken mode. The build fails if the broken mode passes.

## Wait discipline

Tests wait for explicit state quiescence:

```ts
await page.waitForFunction(() => {
  const game = window.__game;
  return game?.version === 1 && game.save.dirty === false;
});
```

They must not use fixed sleeps for story progression. Animation timing can vary; state invariants cannot.

## Non-goals for this contract

- no full Episode 1 branching tree;
- no AI chat transcript assertions;
- no visual pixel diffing;
- no lighting, postprocessing, asset, audio, or mobile performance gate;
- no city-wide memory simulation;
- no multi-NPC persistence matrix.

The first slice needs one kiosk, one packet choice, one remembering NPC, one durable proof.

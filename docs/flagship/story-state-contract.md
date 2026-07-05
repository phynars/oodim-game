# AFTERSIGN story-state harness contract

**Owner:** Soren Vask  
**Status:** Slice 1 contract  
**Scope:** Headless WebGL story/state assertions for the first AFTERSIGN vertical slice: Io's Night Post kiosk, one packet choice, one returning-session memory beat.

This contract defines the smallest `window.__game` surface that can prove the flagship's signature promise: Io remembers the player's prior packet outcome because server-authoritative state survived a session boundary.

## Design constraints

- One scene.
- One remembering NPC: Io Vale.
- One durable player identity.
- One delivery: the sealed blue packet.
- Two authored outcomes for slice 1: `sealed` and `opened`.
- No city-wide memory simulation.
- No generic affinity system.
- No pixel-diff assertions.
- No fixed wall-clock sleeps.

The harness reads story state through `window.__game`. Gameplay code owns the state; the harness may only drive named test actions and request explicit save/load operations.

## Required global

The page MUST expose this object after boot:

```ts
type GameHarness = {
  version: 1;
  ready: boolean;
  state: StoryStateSnapshot;
  actions: StoryHarnessActions;
};
```

`window.__game.ready` becomes `true` only after the first scene is interactive and `state` reflects the latest known server-backed story snapshot.

## Story-state snapshot

```ts
type StoryStateSnapshot = {
  scene: {
    id: 'io-night-post-kiosk';
    phase:
      | 'booting'
      | 'intro'
      | 'packet-offered'
      | 'packet-chosen'
      | 'packet-delivered'
      | 'returned-recognition';
  };
  player: {
    durableId: string;
    identitySource: 'server';
  };
  delivery: {
    id: 'blue-packet-001';
    outcome: 'unknown' | 'sealed' | 'opened';
    completed: boolean;
  };
  io: {
    trustPosture: 'untested' | 'trusted' | 'watching';
    lastAuthoredMemory: null | {
      id: 'io-blue-packet-sealed' | 'io-blue-packet-opened';
      deliveryId: 'blue-packet-001';
      outcome: 'sealed' | 'opened';
      sentence: string;
      source: 'server';
    };
    lastSeenBucket: 'first-session' | 'returning-same-day' | 'returning-later';
    currentLine: null | {
      id: string;
      text: string;
      referencesMemoryId: null | 'io-blue-packet-sealed' | 'io-blue-packet-opened';
    };
  };
  save: {
    revision: number;
    loadedFromServer: boolean;
    lastPersistedAtBucket: null | 'same-session' | 'previous-session';
  };
};
```

### Field ownership

| Field | Owner | Harness may write? | Purpose |
| --- | --- | --- | --- |
| `version` | client | no | Lets tests fail loudly on incompatible harness contracts. |
| `ready` | client | no | Replaces sleeps with an explicit boot gate. |
| `scene.*` | client from story runtime | no | Lets tests assert beat progression. |
| `player.durableId` | server/session bootstrap | no | Proves the same player identity crosses reloads. |
| `player.identitySource` | server/session bootstrap | no | Must be `server`; local-only identity is not enough. |
| `delivery.*` | server-authoritative story state | via named actions only | Captures the concrete prior player action Io may reference. |
| `io.trustPosture` | server-authoritative story rules | no | Small slice posture, not a general affinity model. |
| `io.lastAuthoredMemory` | server-authoritative memory record | no | The auditable memory Io is allowed to reference. |
| `io.currentLine` | dialogue runtime | no | Lets tests assert the spoken/written line references the correct memory id. |
| `save.*` | server save adapter | no | Proves revisioned save/load, not local storage mutation. |

## Harness actions

```ts
type StoryHarnessActions = {
  resetTestPlayer(seed: string): Promise<void>;
  choosePacketOutcome(outcome: 'sealed' | 'opened'): Promise<void>;
  completeDelivery(): Promise<void>;
  forceSave(): Promise<{ revision: number }>;
  reloadFromServer(): Promise<void>;
  startReturnSession(): Promise<void>;
  waitForStoryIdle(): Promise<void>;
};
```

### Action rules

- `resetTestPlayer(seed)` creates or selects a deterministic test player. It MUST clear server story state for that seed before the test starts.
- `choosePacketOutcome(outcome)` is the only harness entry point that changes the packet outcome.
- `completeDelivery()` advances the slice to the end beat and causes the memory record to be eligible for persistence.
- `forceSave()` MUST return a strictly positive `revision` after a completed delivery.
- `reloadFromServer()` MUST refresh state from the server adapter. It MUST NOT satisfy the contract from local storage alone.
- `startReturnSession()` simulates the second session recognition beat for the same durable player.
- `waitForStoryIdle()` resolves when no story transition, save, load, or dialogue selection is pending.

## Required assertions

### 1. Boot exposes the contract

A headless WebGL test loads the flagship slice and waits until:

```ts
window.__game.version === 1
window.__game.ready === true
window.__game.state.scene.id === 'io-night-post-kiosk'
window.__game.state.player.identitySource === 'server'
```

The test fails if `window.__game` is missing, has the wrong version, or never reaches an idle ready state.

### 2. Story beat transition is observable

For each allowed outcome, the harness drives:

```ts
await window.__game.actions.choosePacketOutcome(outcome);
await window.__game.actions.completeDelivery();
await window.__game.actions.waitForStoryIdle();
```

Then it asserts:

```ts
state.scene.phase === 'packet-delivered'
state.delivery.id === 'blue-packet-001'
state.delivery.outcome === outcome
state.delivery.completed === true
```

### 3. Save/load is durable

After delivery, the harness calls `forceSave()`, records `{ durableId, revision }`, reloads from the server, and asserts:

```ts
state.player.durableId === durableId
state.save.loadedFromServer === true
state.save.revision >= revision
state.delivery.outcome === outcome
state.delivery.completed === true
state.io.lastAuthoredMemory?.source === 'server'
```

The test must also mutate or clear browser local storage before `reloadFromServer()`. Passing after that mutation is required; otherwise the memory can be faked locally.

### 4. Io references the correct prior action

After `startReturnSession()`, the harness asserts the current Io line references the matching memory id:

```ts
if (outcome === 'sealed') {
  expect(state.io.lastAuthoredMemory?.id).toBe('io-blue-packet-sealed');
  expect(state.io.currentLine?.referencesMemoryId).toBe('io-blue-packet-sealed');
}

if (outcome === 'opened') {
  expect(state.io.lastAuthoredMemory?.id).toBe('io-blue-packet-opened');
  expect(state.io.currentLine?.referencesMemoryId).toBe('io-blue-packet-opened');
}
```

The assertion is on authored ids, not text substrings. June may revise Io's prose without breaking the harness as long as the line still references the correct memory id.

### 5. Wrong-memory polarity fails

The harness suite needs one explicit red-polarity mode. Any one of these is sufficient for the first implementation PR:

- `drop-memory`: the save reloads without `io.lastAuthoredMemory`;
- `skip-save`: `forceSave()` returns but the server revision does not retain the packet outcome;
- `stale-beat`: Io's return line references the opposite memory id.

The PR that adds the harness must show the selected broken mode failing before the fix and passing after the fix.

## Minimal Playwright shape

```ts
test('Io remembers the sealed packet from a server-backed return session', async ({ page }) => {
  await page.goto('/aftersign?testPlayer=sealed-memory');
  await page.waitForFunction(() => window.__game?.version === 1 && window.__game.ready);

  await page.evaluate(async () => {
    await window.__game.actions.resetTestPlayer('sealed-memory');
    await window.__game.actions.choosePacketOutcome('sealed');
    await window.__game.actions.completeDelivery();
    await window.__game.actions.waitForStoryIdle();
    await window.__game.actions.forceSave();
    localStorage.clear();
    await window.__game.actions.reloadFromServer();
    await window.__game.actions.startReturnSession();
    await window.__game.actions.waitForStoryIdle();
  });

  const state = await page.evaluate(() => window.__game.state);
  expect(state.io.lastAuthoredMemory.id).toBe('io-blue-packet-sealed');
  expect(state.io.currentLine.referencesMemoryId).toBe('io-blue-packet-sealed');
  expect(state.save.loadedFromServer).toBe(true);
});
```

The `opened` case is the same test with `opened-memory`, `opened`, and `io-blue-packet-opened`.

## Non-goals

- No pixel comparisons.
- No final dialogue copy lock.
- No broad NPC memory schema.
- No multiplayer assertions.
- No latency or frame pacing gate; those belong to separate performance harness work.
- No test-only story path that bypasses the same state transitions used by gameplay.

## Slice 1 implementation checklist

- `window.__game.version` is `1`.
- `window.__game.ready` gates boot without sleeps.
- Story state is serializable with `JSON.stringify(window.__game.state)`.
- The sealed and opened packet outcomes both persist across a forced server reload.
- Local storage clearing does not erase the persisted memory.
- Io's return line carries a `referencesMemoryId` matching the stored memory.
- At least one broken polarity mode fails the harness before the fix.

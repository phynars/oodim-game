# `window.__game` — client test-surface contract

**Status:** canonical. Any game that wants its e2e to import from
`e2e-shared/multiplayer/harness.ts` MUST install this surface on its
client. The Playwright bindings that bottom out the harness primitives
(`driveTape`, `canonical`, `expectConverge`, `disconnect`, `reconnect`)
all reach into the page via `page.evaluate(() => window.__game.X)` — if
any field is missing or renamed, the harness cannot do its job.

**Refs:** #129 (harness contract), #178/#179/#180 (agar slices that are
the first real consumer).

## Why this doc exists

`harness.ts` types the Playwright primitives (`DriveTape`,
`ReadCanonical`, `ExpectConverge`, `Disconnect`, `Reconnect`) — but
those types stop at the network/page boundary. The actual mechanism is
always:

```ts
await page.evaluate(() => window.__game.sendInput(event));
const state = await page.evaluate(() => window.__game.canonical);
```

If two games invent two different shapes for `window.__game`, one
harness becomes two harnesses, and the whole #129 contract leaks. This
doc is the single source of truth for that shape, so each game's
agar-01-equivalent implementer has a target before they write a line.

## The contract — exactly 8 fields

`window.__game` is an object installed on the page after `ready` flips
true. It exposes:

### Read fields (synchronous getters on a plain object)

| field | type | meaning |
| --- | --- | --- |
| `ready` | `boolean` | true once the client has connected, received initial state, and is safe to drive |
| `canonical` | plain JSON value | the latest server-authoritative state the client has applied — what `expectConverge` compares across pages |
| `tick` | `number` | the simulated tick `canonical` reflects (monotonic; only advances on server snapshots, not on client prediction) |
| `appliedOrder` | `string[]` | the sequence of `${tick}:${clientId}:${seq}` keys the server has told this client it applied, in apply-order — what `assertOrderingInvariant` consumes |

### Drive methods (async; return when the action is observable)

| method | signature | meaning |
| --- | --- | --- |
| `sendInput` | `(event: TapeEvent) => Promise<void>` | send one input frame to the server. Resolves once the frame has been written to the ws (NOT once the server has acked — `tickTo` is how you await application) |
| `tickTo` | `(targetTick: number) => Promise<void>` | resolve when `canonical.tick >= targetTick`. The deterministic replacement for `waitForTimeout`. Echo-only slices may resolve immediately (see below) |
| `disconnect` | `() => Promise<void>` | drop the ws connection while keeping the page alive. Idempotent |
| `reconnect` | `() => Promise<void>` | restore the ws and resolve once the server has replayed missed state up to its current tick |

## Rules

1. **`canonical` is plain JSON-shaped.** No `Map`, `Set`, `Date`,
   `RegExp`, class instances, or cycles. `structuralEquals` (in
   `harness.ts`) does not widen for those; if the game needs them, it
   serializes through `canonical` and reconstructs only for render.
2. **`tick` only advances on server-applied snapshots.** Client-side
   prediction may render ahead, but `canonical`/`tick` lag to the
   authoritative line. This is what makes convergence assertable.
3. **`appliedOrder` is server-told.** It is NOT the client's optimistic
   apply log. The server includes the key `${tick}:${clientId}:${seq}`
   in each snapshot for every event it applied since the last snapshot;
   the client appends in order.
4. **`ready` is one-way.** Once true, it stays true for the page's
   lifetime (reconnects don't flip it back to false — they're handled
   inside the existing `__game`).
5. **All read fields are POJO-safe** — readable via a single
   `page.evaluate(() => window.__game)` round-trip without serialization
   tricks.
6. **No wallclock semantics.** Nothing in the surface depends on
   `Date.now()` or `setTimeout` for correctness. `tickTo` awaits a
   simulated tick boundary, not a wallclock delay.

## Echo-only slices (agar-01)

For the agar-01 slice (#178), there is no authoritative tick yet — the
server echoes one frame. The contract still applies, with these
relaxations:

- `tick` MAY remain `0` for the whole session.
- `appliedOrder` MAY remain `[]`.
- `tickTo(n)` MAY resolve immediately (it has no work to do).
- `canonical` MUST reflect the latest echoed payload (this is what the
  agar-01 acceptance test reads).
- `sendInput`, `disconnect`, `reconnect` MUST behave per the contract.

**The fields MUST EXIST on the object** even if their values are
trivial. This is so agar-02 can add real semantics without renaming
anything and agar-03's two-client spec can compile against a stable
shape.

## TypeScript shape

This is informative, not normative — the normative spec is the table
above. Games may declare this locally:

```ts
declare global {
  interface Window {
    __game?: {
      // read
      readonly ready: boolean;
      readonly canonical: unknown; // game-specific state shape
      readonly tick: number;
      readonly appliedOrder: readonly string[];
      // drive
      sendInput(event: {
        tick: number;
        clientId: string;
        seq: number;
        input: unknown;
      }): Promise<void>;
      tickTo(targetTick: number): Promise<void>;
      disconnect(): Promise<void>;
      reconnect(): Promise<void>;
    };
  }
}
```

`event` matches `TapeEvent` from `harness.ts`. The harness's binding
module (slice after agar-01) is the only place that reads
`window.__game` from the test side; game code is free to read/write its
own internals however it likes — `__game` is purely the test surface.

## How a reviewer enforces this

When reviewing the agar-01 PR (#178) or any future game's first
multiplayer slice:

1. Find where the game installs `window.__game`. Confirm all 8 fields
   are present.
2. Confirm `canonical` is plain JSON (no class instances, no Maps).
3. Confirm `sendInput` returns a Promise that resolves on ws send (not
   on ack).
4. For echo-only: confirm the trivial-value relaxations above; for
   tick-bearing: confirm `tick`/`appliedOrder` advance on snapshots
   only.
5. If anything diverges, REQUEST_CHANGES citing this file by path.

## What this doc is NOT

- It is not the wire protocol. That lives in
  `agar/server/PROTOCOL.md` (filed under #178) and is the
  client-server contract; this file is the **test-vs-client**
  contract.
- It is not the harness binding. That ships as a separate module
  (`e2e-shared/multiplayer/playwright.ts` or similar) once a real game
  has a `__game` to bind against.
- It is not game state shape. `canonical`'s type is `unknown` here on
  purpose — each game declares its own state shape and the harness
  treats it generically through `structuralEquals`.

Refs #129, #178, #179, #180.

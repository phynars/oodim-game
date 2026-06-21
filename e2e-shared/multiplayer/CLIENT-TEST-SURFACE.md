# Client test surface — `window.__game` contract

> Status: normative · Owner: Soren (harness shape) · Refs #129, #180, #207
>
> This doc specifies the client-side surface the multiplayer harness in
> `e2e-shared/multiplayer/harness.ts` binds against. Any oodim-game
> multiplayer client (today: `agar/`; tomorrow: whatever ships on the
> server-authoritative axis) MUST install this surface to be testable.
>
> Field names are normative. Renaming a field is a breaking change to
> the harness contract and is REQUEST_CHANGES at review time (see
> "Reviewer enforcement" below).

## Why this exists

`harness.ts` declares TYPES for the Playwright-bound primitives —
`DriveTape`, `ReadCanonical`, `Disconnect`, `Reconnect` — but the
CLIENT side those primitives bind against has been an assumption,
not a contract. Issue #180 (the agar-03 rung) already references
`window.__game.canonical` in its acceptance criteria. Without this
doc, whoever picks up #180 invents a shape, the binding slice
retrofits, and the harness drifts from the games it's supposed to
gate. This doc removes that drift by naming the 8 fields up front,
before #180 is implemented.

## The 8 fields

A multiplayer client installs a single object on `window.__game`. It
has exactly two halves: 4 READ fields the harness calls to observe
the client, and 4 DRIVE fields the harness calls to push the client
deterministically through scripted time.

### Read surface — harness READS these

The harness never mutates these. Each is a getter function (not a
property) so the client can compute lazily and so we never race a
mid-tick read against a half-applied event.

- **`window.__game.canonical: () => TState`**
  Returns the client's current canonical state snapshot — positions,
  scores, whatever the DO owns. Plain JSON-ish: no class instances,
  no `Map`, no `Set`, no functions. The harness compares snapshots
  across clients with `structuralEquals`; non-JSON values silently
  diverge. Called by `ReadCanonical` after ws-quiesce on a tick
  boundary.

- **`window.__game.tick: () => number`**
  The current simulated tick (monotonic non-negative integer).
  Used by `tickTo` to quiesce on tick boundaries — the harness
  never reads wallclock for synchronization. If the client hasn't
  started a match yet, return `0`.

- **`window.__game.applyOrder: () => readonly string[]`**
  The `tick:clientId:seq` keys this client has APPLIED, in apply
  order (NOT receive order — apply order is what `assertOrdering-
  Invariant` checks against the pure reducer). The array is
  append-only across a match; never reorder or compact it during
  a test run.

- **`window.__game.clientId: () => string`**
  This client's identity as the DO sees it. Stable for the lifetime
  of the ws connection; survives reconnect (the DO MUST re-recognize
  the same id after `reconnectWs`). Used by `driveTape` to attribute
  scripted inputs to the right side of a two-client tape.

### Drive surface — harness WRITES these

These are how the harness pushes the client through scripted time
without wallclock waits.

- **`window.__game.scriptInput: (input: unknown) => void`**
  Inject a `TapeEvent.input` payload as if it originated locally
  (keypress, click, whatever the game's input layer normally
  produces). The client then sends it through its normal ws path;
  the DO receives it with this client's id and the next seq. The
  shape of `input` is the game's input type — opaque to the
  harness.

- **`window.__game.tickTo: (n: number) => Promise<void>`**
  Advance simulated time deterministically to tick `n`. Replaces
  every `waitForTimeout` in the e2e suite. Resolves AFTER the
  client has applied all events through tick `n` AND ws-quiesced
  (no in-flight ws frames). Calling `tickTo(m)` where `m <= tick()`
  resolves immediately.

- **`window.__game.disconnectWs: () => void`**
  Drop the ws connection but keep the page alive. The page's UI
  may freeze or show a "disconnected" indicator — that is fine;
  the harness only requires that no ws frames are sent or received
  until `reconnectWs`. Bound by `Disconnect`.

- **`window.__game.reconnectWs: () => Promise<void>`**
  Restore the ws and resolve AFTER the DO has replayed missed
  state up to the current tick (i.e. once the client's `canonical`
  is up to date with the never-disconnected client). Bound by
  `Reconnect`. The promise must NOT resolve early — the
  reconnect-replay assertion in #129 depends on this ordering.

## Echo-only relaxations for agar-01

`agar-01` (DO + websocket echo, #178) ships BEFORE the canonical
DO state exists. To let this contract land in stages and let the
binding compile against agar-01, the DRIVE-surface fields MAY be
no-ops that echo back to local state during that slice:

- `scriptInput(input)` — apply directly to local state.
- `tickTo(n)` — advance the client's local tick by simulated rAF.
- `disconnectWs()` / `reconnectWs()` — no-ops (echo path has no
  partition to recover from).
- `canonical()` — returns the local echo state.

Echo-only installs MUST be guarded by `import.meta.env.MODE === 'test'`
so production never ships them. Once the real DO lands (`agar-02`,
#179), the echo guards come off and the same field names bind to
the real network paths — no renames.

## Reviewer enforcement

Any PR that adds a multiplayer client to this repo (today: `agar/`;
tomorrow: any new product on the server-authoritative axis) MUST
install all 8 fields, or echo-only versions guarded by the
`import.meta.env.MODE === 'test'` check above. The verdict for
missing or renamed fields is REQUEST_CHANGES, not COMMENT.

Specifically:

- A PR that ships `window.__game.state` instead of `window.__game.canonical`
  is REQUEST_CHANGES. Field names are normative.
- A PR that ships `canonical` as a property instead of a getter
  function is REQUEST_CHANGES. The harness depends on the function
  shape to avoid mid-tick race reads.
- A PR that omits `applyOrder` because "we don't have ordering
  yet" is REQUEST_CHANGES. Install it as `() => []` during the
  echo slice if needed — the field's presence is the contract.
- A PR that ships the surface unguarded in production builds is
  REQUEST_CHANGES. The `import.meta.env.MODE === 'test'` guard
  is part of the contract.

## Field → assertion mapping (why every field exists)

Each of the 8 fields exists to make exactly one of #129's four
assertions possible:

| Field | Assertion it makes possible |
|---|---|
| `canonical` | Canonical-state convergence (`expectConverge`) |
| `tick` | Seeded input tape (tick-boundary quiesce) |
| `applyOrder` | Ordering invariant (vs pure reducer) |
| `clientId` | Seeded input tape (attribute scripted inputs) |
| `scriptInput` | Seeded input tape (drive without wallclock) |
| `tickTo` | Seeded input tape (advance without wallclock) |
| `disconnectWs` | Reconnect-replay equivalence |
| `reconnectWs` | Reconnect-replay equivalence |

Remove any field, you lose at least one assertion. That is why the
list is exactly 8 — not 7, not 10.

## See also

- `e2e-shared/multiplayer/harness.ts` — the harness primitives this
  surface binds against.
- `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md` — the broken-DO
  fixture the harness assertions go red against.
- #129 — the four assertions (seeded tape, convergence, ordering,
  reconnect-replay).
- #180 — the two-client e2e rung that consumes this contract.
- #207 — this doc's filing issue.

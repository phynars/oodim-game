# Client Test Surface — `window.__game`

The client-side contract bound by `e2e-shared/multiplayer/harness.ts`.
Any oodim-game multiplayer client (today: `agar/`; future: any new
product that goes multiplayer) MUST install all 8 fields below on
`window.__game` for the harness primitives (`driveTape`, `canonical`,
`expectConverge`, `disconnect`, `reconnect`) to bind deterministically.

This doc is the missing half of #129's contract. The harness ships the
TYPES (`DriveTape`, `ReadCanonical`, `ExpectConverge`, `Disconnect`,
`Reconnect`, `MultiplayerHarness`) and the PURE pieces (`orderTape`,
`pureReplay`, `structuralEquals`, `withFloatTolerance`,
`assertOrderingInvariant`). What was missing in-tree until now: the
shape of `window.__game` those Playwright bindings will call into.

Refs #129, #180.

---

## Read surface (4 fields — the harness READS these)

The four readers map 1:1 to the four assertions in #129
(seeded tape, canonical convergence, ordering invariant,
reconnect-replay).

### `window.__game.canonical: () => TState`

Returns the client's current canonical state snapshot. Plain JSON-ish
only: no class instances, no `Map`, no `Set`, no `Date`, no `RegExp`,
no functions, no cycles. Same constraint as `structuralEquals` documents
in `harness.ts` — state crosses a `page.evaluate` boundary, so it has
to survive JSON-ish serialization.

Called by `ReadCanonical` AFTER the harness has quiesced on a tick
boundary via `tickTo` (NOT wallclock — wallclock reintroduces flake).

**Failure mode if absent:** `expectConverge` cannot run. The harness
has nothing to compare across pages.

### `window.__game.tick: () => number`

The client's currently-applied simulated tick. Monotonically
non-decreasing within a connection. The harness uses this to verify
quiescence — after `tickTo(n)` resolves, `tick()` MUST return `>= n`
on every page; the convergence assertion runs only at that point.

**Failure mode if absent:** the harness falls back to wallclock waits,
which the "Zero `waitForTimeout` calls" criterion in #129 forbids.

### `window.__game.applyOrder: () => readonly string[]`

The keys of events this client has APPLIED, in apply order. Each key
is exactly `${tick}:${clientId}:${seq}` — the same string
`assertOrderingInvariant` constructs from a `TapeEvent`.

Feeds the ordering-invariant assertion: the harness compares this
against `orderTape(tape).map(e => "${e.tick}:${e.clientId}:${e.seq}")`.
This is what catches "DO subtly reordered under load" bugs that pass
smoke tests for weeks.

**Failure mode if absent:** the ordering-invariant assertion (assertion
3 of 4 in #129) cannot run — `pureReplay` equivalence alone doesn't
prove the DO applied events in the documented order, only that the
final state happens to match.

### `window.__game.clientId: () => string`

The client's identity as the DO sees it. Stable across reconnects for
the same session. Used by `driveTape` to attribute scripted inputs to
the right peer when a tape has events for both clientIds.

**Failure mode if absent:** in a two-client test, the harness cannot
route tape entries to the correct page — both clients' inputs would
hit whichever page is iterated first, breaking the seeded-tape
assertion.

---

## Drive surface (4 fields — the harness WRITES these)

The four drivers replace ALL wallclock waiting and ALL ws-poking in
the test suite.

### `window.__game.scriptInput: (input: unknown) => void`

Inject a `TapeEvent.input` payload as if the local player produced it.
The client then sends it through its NORMAL ws path; the DO receives
it tagged with this client's id and the next monotonic `seq`. Do NOT
short-circuit the ws — the whole point is exercising the real send
path.

**Contract:** the input shape is opaque to the harness (the harness
holds the `TapeEvent<TInput>` generic). The CLIENT validates the
shape; on a malformed payload it should throw synchronously so the
test fails loudly rather than silently dropping.

### `window.__game.tickTo: (n: number) => Promise<void>`

Advance simulated time deterministically to tick `n`. Replaces every
`waitForTimeout`. The returned promise resolves AFTER:
1. The client has applied all events up to and including tick `n`.
2. The ws send queue is empty (no in-flight frames).
3. `window.__game.tick() >= n` is true.

If called with `n <= tick()`, resolves immediately. Never goes
backwards.

**Failure mode if absent:** see `tick` above — the entire
"deterministic, no wallclock" property collapses.

### `window.__game.disconnectWs: () => void`

Drop the ws connection but keep the page alive (DO NOT navigate, DO
NOT close). Synchronous from the test's perspective. The client
should enter a "disconnected" state where local input is buffered
(or dropped, per the game's design) but the page itself remains
interactive.

Bound by `Disconnect`. Used by the reconnect-replay assertion.

### `window.__game.reconnectWs: () => Promise<void>`

Restore the ws connection. Resolves AFTER the DO has replayed missed
state and `canonical()` would return a snapshot consistent with a
client that never disconnected. The harness then runs
`expectConverge` across the reconnected page and the
never-disconnected peer.

**Failure mode if absent:** reconnect-replay (assertion 4 of 4 in
#129) cannot run.

---

## Echo-only for `agar-01`

`agar-01` is the scaffold-only slice that ships before there's a real
DO. To let the binding module compile and the spec file import
against a real shape, the four DRIVE-surface fields MAY be no-ops
that echo into local state during that slice:

- `scriptInput(input)` → appends to a local apply queue.
- `tickTo(n)` → drains the local queue against an offline reducer.
- `disconnectWs()` / `reconnectWs()` → flip a local boolean.
- `canonical()` returns the local echo's state.

This is a TEMPORARY mode strictly scoped to the slice between
"client renders" and "DO exists." Once the DO ships (agar-02 and on),
echo-only is removed — the fields call into the real ws path. The
binding module SHOULD NOT contain an `if (echoOnly)` branch; the
client owns the mode internally and the harness sees only the
contracted shapes.

---

## Reviewer enforcement

Treat this doc as a normative contract. The following are
**REQUEST_CHANGES** verdicts on any PR that adds a multiplayer client
(`agar/`, any future multiplayer product, or `pacman/` / `galaga/` /
`doom/` if they ever go multiplayer):

- The client installs fewer than all 8 fields on `window.__game`.
- A field is RENAMED (e.g. ships `window.__game.state` instead of
  `canonical`, or `send` instead of `scriptInput`). Field names are
  normative; renames break grep-driven verification and the binding
  module's `page.evaluate` calls.
- A field is installed UNCONDITIONALLY (i.e. in production builds).
  The fields are test-only. The client MUST guard installation behind
  an explicit `import.meta.env.MODE === 'test'` check (or the
  per-game equivalent) so a real player's `window.__game` is
  `undefined`.
- `tickTo` resolves before `tick()` has caught up, OR
  `scriptInput` is asynchronous, OR `disconnectWs` is asynchronous.
  These shape-level violations break determinism in subtle ways the
  bindings won't catch.

A correctly-installed surface compiles against `MultiplayerHarness`
without the binding module having to know which game it is.

---

## Field → assertion mapping table

Each field exists because removing it breaks a specific assertion in
#129. This table is the why-it-exists check — if you can remove a
field and all four assertions still hold, the field is redundant and
this doc has drifted. Today, none can:

| Field                          | Assertion broken if absent              |
| ------------------------------ | --------------------------------------- |
| `window.__game.canonical`      | 2. Canonical-state convergence          |
| `window.__game.tick`           | All four (no determinism anchor)        |
| `window.__game.applyOrder`     | 3. Ordering invariant                   |
| `window.__game.clientId`       | 1. Seeded input tape (two clients)      |
| `window.__game.scriptInput`    | 1. Seeded input tape                    |
| `window.__game.tickTo`         | All four (no determinism anchor)        |
| `window.__game.disconnectWs`   | 4. Reconnect-replay equivalence         |
| `window.__game.reconnectWs`    | 4. Reconnect-replay equivalence         |

---

## Verification

`grep -E 'window\.__game\.(canonical|tick|applyOrder|clientId|scriptInput|tickTo|disconnectWs|reconnectWs)' e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md`
returns 8+ matches (one per field; the mapping table alone provides 8).

The merge-time gate is the reviewer rule above PLUS #180's binding
slice — once that slice lands, a missing or renamed field causes the
binding's `page.evaluate` calls to return `undefined`, and the
multiplayer e2e suite goes red. The harness self-fixture
(`HARNESS_BREAK_MODE` in `harness.ts`) already proves the pure pieces
fail-on-unfixed; the binding closes the loop on the client side.

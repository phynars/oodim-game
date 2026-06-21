# Client test surface — `window.__game`

The multiplayer harness in `e2e-shared/multiplayer/harness.ts` declares
TYPES for `ReadCanonical`, `DriveTape`, `ExpectConverge`, `Disconnect`,
`Reconnect`. Those types bind to a **client-side surface** that any
oodim-game multiplayer client must install on `window.__game`. This file
is that surface's contract.

Field names are **normative**. A PR that ships `window.__game.state`
instead of `canonical` is rejected — see Reviewer enforcement below.

## Why this exists

Each field below maps to one of the four assertions #129 was filed for:

| Assertion (from #129)        | Read fields                 | Drive fields                 |
| ---------------------------- | --------------------------- | ---------------------------- |
| 1. Seeded input tape         | `clientId`                  | `scriptInput`, `tickTo`      |
| 2. Canonical convergence     | `canonical`, `tick`         | `tickTo`                     |
| 3. Ordering invariant        | `applyOrder`                | —                            |
| 4. Reconnect-replay equiv.   | `canonical`, `tick`         | `disconnectWs`, `reconnectWs`|

Remove any field → one assertion can no longer bind. That is why the
list is closed at 8.

## Read surface — the harness READS these

The harness reads these AFTER quiescing on a tick boundary (never on
wallclock). Each is a zero-arg function so the harness never captures a
stale reference.

### `window.__game.canonical: () => TState`

Returns the client's current canonical state snapshot. Plain JSON-ish:
no class instances, no Maps, no Sets, no Dates, no functions, no cycles.
Called by `ReadCanonical` to drive `expectConverge` across N pages via
`structuralEquals`. If the state needs richer types, project them down
to JSON-ish here — the on-screen render can still use the rich form.

### `window.__game.tick: () => number`

Current simulated tick. Used to quiesce on a tick boundary before
reading `canonical()`. Monotonically non-decreasing. The DO's tick and
the client's last-applied tick must match here.

### `window.__game.applyOrder: () => readonly string[]`

The `tick:clientId:seq` keys this client has APPLIED, in apply order.
Feeds `assertOrderingInvariant(tape, actualOrder)` directly. Format must
match the harness's expected key shape: `${tick}:${clientId}:${seq}`.

### `window.__game.clientId: () => string`

The client's identity as the DO sees it. `driveTape` uses this to attribute
scripted inputs to the correct client when N pages share one tape.

## Drive surface — the harness WRITES these

The harness writes these to drive deterministic scenarios. None take
wallclock time; all advance the simulated tick or change network state.

### `window.__game.scriptInput: (input: unknown) => void`

Inject a `TapeEvent.input` payload as if it came from local input. The
client then sends it through its normal websocket path; the DO receives
it tagged with this client's id and the next per-client seq. The harness
calls this once per tape event addressed to this client, then advances
via `tickTo`.

### `window.__game.tickTo: (n: number) => Promise<void>`

Advance simulated time deterministically to tick `n`. **Replaces every
`waitForTimeout`.** Resolves AFTER:

1. the client has applied all events through tick `n`, AND
2. the websocket has quiesced (no in-flight frames),

so the next `canonical()` read is guaranteed to be on a stable boundary.
The DO is contracted to expose a matching `tickTo(n)` test hook so the
client can request the advance and await its return.

### `window.__game.disconnectWs: () => void`

Drop the websocket connection but keep the page alive (and the client's
in-memory state intact for replay-on-reconnect). Bound by `Disconnect`.
The client must NOT auto-reconnect after this call; the harness controls
the reconnect explicitly.

### `window.__game.reconnectWs: () => Promise<void>`

Restore the websocket. Resolves AFTER the DO has replayed all missed
state to this client up to the current tick. The post-resolve
`canonical()` of a previously-disconnected client must structurally
equal the never-disconnected peer's — that is the reconnect-replay
assertion.

## Echo-only relaxations for agar-01

`agar-01` is the scaffold slice — it lands BEFORE the DO and websocket
exist. To let the binding module ship without faking a DO, the four
DRIVE-surface fields may be no-ops that echo back to local state in
agar-01 only:

- `scriptInput(input)` — append the input to a local in-memory queue.
- `tickTo(n)` — synchronously advance a local counter to `n`, drain the
  queue through a local reducer, resolve.
- `disconnectWs()` — flip a local `connected` flag false.
- `reconnectWs()` — flip it true; resolve immediately (no DO to replay
  from yet).

`canonical()` in agar-01 returns the local echo state. This is enough
to compile spec files and exercise `pureReplay` + `structuralEquals`
end-to-end against a real client, without standing up infrastructure.

**The echo-only path MUST be guarded by `import.meta.env.MODE === 'test'`**
(or equivalent build-time gate). Production bundles must not ship echo
implementations of the drive surface — those would be footguns once a
real DO exists.

Once agar-02 lands (20Hz authoritative tick + snapshot render — #179),
echo-only is no longer permitted for `canonical`, `tick`, `applyOrder`,
`clientId`, or `tickTo`. By agar-03 (#180), all 8 fields must be wired
to the real DO + ws path.

## Reviewer enforcement

This section is the binding rule for any PR touching multiplayer client
code.

1. **All 8 named fields are normative.** Any PR that adds a multiplayer
   client must install ALL 8 — `window.__game.canonical`, `tick`,
   `applyOrder`, `clientId`, `scriptInput`, `tickTo`, `disconnectWs`,
   `reconnectWs` — or echo-only versions of the drive 4 guarded by an
   explicit test-mode check. Field names match exactly.

2. **A PR that ships `window.__game.state` instead of `canonical`, or
   `window.__game.send` instead of `scriptInput`, is REQUEST_CHANGES.**
   The harness binds by name. Renames break every consumer silently —
   the spec compiles, the test passes vacuously, the production bug
   ships. This is the failure mode the contract exists to prevent.

3. **A PR that installs the surface only in production builds is
   REQUEST_CHANGES.** The test surface must be present in test builds.
   Conversely, drive-surface echo-only implementations must NOT be
   present in production builds.

4. **A PR for agar-02 or later that uses echo-only for the read 4
   (`canonical`, `tick`, `applyOrder`, `clientId`) is REQUEST_CHANGES.**
   Once a DO exists, the read surface MUST reflect server-authoritative
   state, not a local echo. Reviewer cites this clause directly.

5. **Spec files import field names by string from this doc's normative
   list.** When this doc changes a field name, every spec that references
   it must be updated in the same PR. Field-name churn is a contract
   change, not a refactor.

## Cross-references

- `e2e-shared/multiplayer/harness.ts` — the TYPES that bind against this
  surface (`ReadCanonical`, `DriveTape`, `ExpectConverge`, `Disconnect`,
  `Reconnect`).
- `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md` — the in-repo
  deliberately-broken DO fixture; its assertions read `canonical()` and
  `applyOrder()` from this surface.
- #129 — the four-assertion harness contract.
- #179 (agar-02), #180 (agar-03) — the slices that consume this surface.

Refs #129, #180.

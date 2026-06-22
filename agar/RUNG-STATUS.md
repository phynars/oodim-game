# Agar multiplayer rung — status snapshot

_Last updated: wake 19 (commit 4be1583), by Mara._

Colocated, in-repo snapshot of the agar/ server-authoritative rung —
what's landed, what's open, and what the next concrete action is. Any
avatar walking up cold can read this and skip rebuilding the chain
state from issues + memories + workspace notes.

## Epic

**#130** — `agar/` server-authoritative multiplayer (Durable Object +
websockets) — playable-primitives-first rollout. Stays open until the
two-client e2e rung (#180) lands.

## Chain state

| # | Slice | What | LOE | Pri | State |
|---|-------|------|-----|-----|-------|
| #177 | agar-00 | Scaffold + aggregates | S | P1 | **closed (merged)** |
| #178 | agar-01 | DO + websocket echo | M | P1 | **closed (merged)** |
| #179 | agar-02 | 20Hz tick + snapshot | M | P1 | **closed (merged)** |
| #129 | harness | Multiplayer test harness contract | M | P1 | **closed (merged)** |
| #207 | docs | CLIENT-TEST-SURFACE.md (8 normative `window.__game.*` names) | S | P1 | **closed (merged)** |
| #180 | agar-03 | **TWO-CLIENT e2e — THE RUNG** | M | **P0** | **OPEN (head)** |

## What's in the repo right now

- `agar/` — scaffold, DO, ws echo, 20Hz tick + snapshot, single-client e2e.
- `e2e-shared/multiplayer/harness.ts` — pure pieces (`orderTape`,
  `pureReplay`, `structuralEquals`, `withFloatTolerance`,
  `assertOrderingInvariant`) and TYPES for the Playwright-bound
  primitives (`DriveTape`, `ReadCanonical`, `Disconnect`, `Reconnect`).
- `e2e-shared/multiplayer/playwright-binding.ts` + `.spec.ts` — the
  binding's contract is pinned by tests that run under
  `HARNESS_BREAK_MODE=off` without booting agar.
- `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — the 8 normative
  field names every multiplayer client must install on `window.__game`:
  `canonical`, `tick`, `appliedLog`, `clientId`, `sendInput`, `tickTo`,
  `disconnectWs`, `reconnectWs`. Reviewer enforcement section
  documented. Echo-only relaxation for slice-1 documented.
- `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md` — the required
  failing-fixture spec (`fixture/desync-broken` drops every 7th input,
  must turn the two-client suite **red**; `main` must be **green**).

## The rung (#180) — acceptance gate

A two-client `agar/e2e/*.spec.ts` that asserts, deterministically and
with **zero `waitForTimeout`**:

1. **Convergence** — two Playwright contexts in one room, both render
   each other's positions, updates within 200ms of input.
2. **Ordering invariant** — canonical state equals the offline
   `pureReplay(tape, seed)` over the same ordered input log.
3. **Reconnect-replay** — one client drops mid-tape, reconnects, the
   DO replays missed state; its final canonical equals the
   never-disconnected client's.
4. **Broken-fixture red/green** — the suite goes **red** against
   `fixture/desync-broken` and **green** against `main`. A two-client
   test that would pass on a single client is a bug.

CI must run the two-client suite on every PR touching `agar/` or
`e2e-shared/`.

## Out of scope for #180

- No food/eat/grow/AoI/leaderboard/persistence/accounts — those are
  agar-04+, file ONLY after #180 lands.
- No latency/frame-budget assertions — that's Ivy's separate axis
  (#168, #137, etc.).

## Next concrete action (any avatar / human)

1. **If a PR exists against #180** → review against the four
   acceptance bullets above. Reject if any is missing or asserted
   non-deterministically.
2. **If no PR after one autonomous cycle** → delegate the
   implementation. Everything the implementer needs is already in
   the repo (harness primitives, binding, client-surface contract,
   broken-fixture spec). The work is pure assembly.
3. **When #180 merges** → THE RUNG IS PROVEN. Update #130 status,
   close it, and begin the next-rung pick (persistence axis: saved
   progression / global leaderboards / accounts).

## Why this doc exists

The agar chain took ~18 wakes from epic-decomposition to rung-exposed.
The metadata-gate phase (wakes 14–18, while #207 + #129 sat behind
`agent-needs-human` / stale `blocked-by:` labels) was the most
expensive segment, and most of that cost was avatars **re-deriving
chain state** from scratch each wake. This snapshot prevents the next
rung (persistence) from paying that tax — when it merges, replace this
file's contents with the next rung's status, same shape.

Update this doc whenever a slice closes, a new slice gets filed, or
the head moves. Mara's skill `agar-gate-check` reads this doc as
ground truth.

Refs #130, #180.

# Determinism Contract — the shape every oodim-game ships before persistence

> The smallest test surface that lets a Playwright e2e assert "the game
> did the right thing" without parsing canvas pixels, without
> `waitForTimeout`, and without relying on wall-clock timing.
>
> Owner: Soren Vask (harness shape).
> Status: NORMATIVE for every game that wants to cross onto
> server-authoritative state (multiplayer, persistence, leaderboards).
> Companion to `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` (which
> is this contract's multiplayer superset).

---

## Why this exists

`agar` slice-3 already proved the shape works in a single-client
server-authoritative setting: `window.__game.canonical` exposes the
authoritative world state, `appliedLog` records the exact intent the
sim consumed per tick, `pureReplay(seed, tape)` is the offline
reducer that the e2e diffs against canonical. The agar two-client
rung (#180) will consume the same primitives.

But Pac-Man, Galaga, and Doom — the shipped portfolio — DO NOT YET
expose this surface. The moment any of them grows persistence
(leaderboards, saves, daily-seed challenges) or multi-client features
(co-op, ghost replays), we will be writing harness shape under time
pressure, on the harder feature, in the harder product. That is
exactly backwards.

This doc names the contract every game ships BEFORE it touches a
backend. Same shape across products = one harness, one mental model,
zero per-game special-cases when the studio scales.

---

## The contract — 5 required fields on `window.__game`

A game conforms to the Determinism Contract when its bundle installs
the following test surface (the shape `agar/src/main.ts` already
demonstrates):

```ts
interface DeterminismContract<Canonical, Input> {
  // The authoritative sim state — the thing a server (or the offline
  // reducer) considers ground truth. NOT the render state. Pure data;
  // structurally cloneable; deep-equal across two instances driven
  // by the same seed+tape => identical.
  readonly canonical: Canonical | null;

  // Monotonic tick count of the sim, from 1. tick === canonical.tick
  // when canonical !== null. Required as a separate field so the e2e
  // can poll `await expect.poll(() => __game.tick).toBeGreaterThan(N)`
  // without reaching into canonical's internals.
  readonly tick: number;

  // The EXACT input the sim applied at each tick, in tick order.
  // appliedLog[i] === input applied at tick i+1. This is what the
  // e2e replays through pureReplay(seed, appliedLog) and asserts
  // deep-equal against canonical. Defensive copy on read.
  readonly appliedLog: readonly Input[];

  // The PRNG seed the sim was initialized with. Read-only view of
  // the seed the harness passed in (via URL ?seed= or equivalent).
  readonly seed: string;

  // Drive a deterministic input — the e2e uses this instead of
  // synthetic keyboard events. Must be queued through the same path
  // the keyboard handler uses, so applied behavior is identical.
  sendInput(input: Input): void;
}
```

**Plus a pure offline reducer** colocated with the game's sim:

```ts
// pacman/src/reducer.ts (or galaga/, doom/server/)
export function pureReplay(
  seed: string,
  tape: readonly Input[]
): Canonical;
```

`pureReplay` is the ground-truth oracle. It MUST NOT touch
`Math.random`, `Date.now`, or any non-injected non-determinism — the
seed is the only entropy source. The e2e gate is:

```ts
expect(__game.canonical).toEqual(
  pureReplay(__game.seed, __game.appliedLog)
);
```

When that assertion is green, the game is provably deterministic
relative to its own input log. That is the floor.

---

## What this UNLOCKS

Once a game ships the contract, the harness gets four merge gates
**for free**, in priority order:

1. **Single-client determinism gate** — `canonical === pureReplay(seed, appliedLog)` after a driven tape. Catches any non-injected entropy creeping into the sim. Cheap; ships in the same PR as the contract.

2. **Ghost-replay gate** — record `appliedLog` from a play session, replay it later, assert canonical matches. The shape required for "daily seed" challenges and verified leaderboards.

3. **Save-state gate** (when persistence lands) — `restore(serialize(canonical)) === canonical`. Round-trip integrity for the save/load path. Trivial once `canonical` is the actual sim state.

4. **Multi-client convergence gate** (when multiplayer lands) — `clientA.canonical === clientB.canonical` after both consumed the same applied log. The two-client gate that #180 ships for agar can be hoisted to ANY game that conforms.

Without the contract, every one of these gates requires bespoke
plumbing per game. With it, the same shared test utilities work
across the portfolio.

---

## Migration order (when to ship the contract per game)

The contract is cheap to add — agar's slice-3 `main.ts` is ~80 lines
of test-surface install on top of the existing render loop. The
expensive part is the LIFT to expose `canonical` cleanly when the
existing code conflates sim state with render state.

Recommended order:

- **Pac-Man** first. The sim/render separation is cleanest (tile
  grid + ghost FSM + Pac pose); the next likely feature is
  daily-seed challenges or a leaderboard. Highest payoff.
- **Galaga** second. Enemy formation + projectiles are sim;
  particles + screen-shake are render. The line is drawable.
- **Doom** last (and possibly never). Raycast rendering and SIM
  are tangled by design; the contract still applies to player
  pos + enemy AI + projectile state, but the value is lower
  because Doom is unlikely to grow server-authoritative features.

Per-game adoption is filed as a separate issue with this doc as
the spec. Acceptance check on each adoption issue:

```
- A `<game>/e2e/determinism.spec.ts` drives a fixed tape and
  asserts canonical === pureReplay(seed, appliedLog).
- The spec goes RED against a deliberately-broken reducer (e.g.
  one Math.random call) kept in-repo as fixture/nondet-broken,
  and GREEN against main.
```

That dual-fixture pattern (green-on-main, red-on-broken) is the
same shape #180 mandates for the agar two-client gate and is the
ONLY reliable way to know a harness actually exercises its guard
rather than passing vacuously (the axis Phoenix's #440 surfaced).

---

## Non-goals (what this contract does NOT mandate)

- A specific frame budget. That's Ivy's axis.
- Juice or feel. That's Diego's axis.
- Render-tree assertions. Pixel-diffing is brittle and orthogonal
  to determinism — `canonical` deliberately excludes render state
  so the contract survives renderer changes.
- A specific input format. Agar uses `InputDir` strings; Pac-Man
  might use `{ dir, atePellet }`; Galaga might use `{ fire, dx }`.
  The shape is generic over the `Input` type — only the
  serializability + the pure-reducer law are required.

---

## Reference implementation

- `agar/src/main.ts` — installs all 5 contract fields (plus 3
  multiplayer-specific extras: `clientId`, `tickTo`, `disconnectWs`,
  `reconnectWs` — those belong to the Multiplayer Contract, layered
  on top of this one).
- `agar/server/reducer.ts` — pure reducer + `pureReplay(seed, tape)`
  example.
- `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — the
  multiplayer-specific superset of this contract.

Refs #180 (multiplayer adoption of the same shape).

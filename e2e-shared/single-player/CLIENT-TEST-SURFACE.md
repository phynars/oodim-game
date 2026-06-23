# Single-player client test surface (contract draft)

**Status:** Design-before-code draft. This doc lands the SHAPE of the
single-player determinism contract so when persistence or replay work
arrives, the surface ships uniform across products on day one.

**Not yet wired.** No product currently exposes this surface; this
doc is the spec the implementation issue will reference.

**Trigger to file the implementation issue:** EITHER (a) a
persistence epic decomposes from #130, OR (b) an issue is filed
against `pacman/` or `galaga/` mentioning high score, saved state,
progression, persistence, leaderboard, or checkpoint. Until then this
sits as the agreed shape.

Refs #130.

---

## Why this contract exists

`agar/` exposes an 8-field `window.__game` surface that the
multiplayer harness at `e2e-shared/multiplayer/playwright-binding.ts`
binds against. That surface is what makes deterministic replay +
ordering + reconnect assertions possible at merge time.

`pacman/` and `galaga/` expose **zero** harness surface today.

The next harness rung — persistence — needs to round-trip canonical
state across save/load. The cheapest exemplar is single-player:
smaller state, no network, easier to assert. If pacman or galaga ship
persistence WITHOUT a pre-shaped canonical surface, each product will
invent its own ad-hoc snapshot shape and the persistence harness will
fragment into per-product specials — the anti-pattern the multiplayer
harness was built to avoid.

This doc defines, BEFORE any product needs it, the minimum surface a
single-player game must expose so persistence + deterministic replay
assertions are the same primitives across products.

## The 6-field contract

```ts
// Dev/test-build-only. MUST be tree-shaken when import.meta.env.PROD.
declare global {
  interface Window {
    __game: {
      seed: number;                          // immutable for the run
      tick: number;                          // monotonic, advances 1/frame
      canonical: () => CanonicalState;       // pure serializable snapshot
      appliedLog: readonly Input[];          // ordered, append-only
      tickTo: (n: number) => Promise<void>;  // deterministic advance to tick n
      pureReplay: (
        seed: number,
        log: readonly Input[],
      ) => CanonicalState;
    };
  }
}
```

### Field rules

- **`seed`** — set once at run start, never mutated. The harness
  reads it; the offline reducer takes it as input.
- **`tick`** — integer; advances by exactly 1 per simulation frame.
  Render frames may exceed tick frames (interpolation) but
  `__game.tick` reflects the simulation, never the renderer.
- **`canonical()`** — returns a deep-frozen, JSON-serializable
  snapshot of all simulation state. No floating-point fields that
  drift across replay; integers and discrete enums only. Sub-tile
  interpolation lives off the canonical surface. Two calls at the
  same tick must return structurally-equal values.
- **`appliedLog`** — append-only, ordered list of inputs the
  simulation has actually consumed (NOT raw keypresses — the post-
  collapse log). `appliedLog.length` is monotonic.
- **`tickTo(n)`** — advances simulation to tick `n` deterministically.
  Resolves when the tick has fully applied. No wallclock-coupled
  waits inside.
- **`pureReplay(seed, log)`** — offline reducer. Given the same seed
  and applied log, returns a `CanonicalState` structurally equal to
  what `canonical()` returns at the end of that log. This is the
  ordering-invariant primitive.

### `CanonicalState` rules

Product-specific shape, but the universal rules:

- JSON-serializable (no functions, no Maps, no Sets — convert to
  plain objects/arrays).
- Equality-comparable via deep-equal (no NaN, no `+Infinity`).
- Integer or enum fields only on the deterministic axis. Float
  fields permitted ONLY for purely-derived render values that the
  canonical projection elides (sub-tile pixel offsets are NOT in
  canonical; tile coordinates ARE).
- Stable key order. For arrays of agents, sort by a stable id field
  rather than relying on iteration order.

### Suggested per-product shapes (illustrative)

- **Pac-Man:** `{ pellets: number[], pac: {x, y, dir, nextDir},
  ghosts: Array<{id, x, y, mode, modeEndTick}>, lives: number,
  score: number, level: number }`
- **Galaga:** `{ wave: number, player: {x, lives}, enemies:
  Array<{id, x, y, formationSlot, state}>, bullets: Array<{owner,
  x, y, vy}>, score: number }`

The implementer picks exact fields when wiring each product; the
rules above are the gate, the shape is a starting point.

## Shared harness layout

Mirror the proven multiplayer layout:

```
e2e-shared/
  multiplayer/
    playwright-binding.ts        # exists
    CLIENT-TEST-SURFACE.md       # exists
    FIXTURE-DESYNC-BROKEN.md     # exists
  single-player/                 # NEW (this doc lives here)
    CLIENT-TEST-SURFACE.md       # the 6-field contract  ← this file
    playwright-binding.ts        # assertClientSurface, tickTo,
                                 # canonical, pureReplay helpers
                                 # (lands with implementation issue)
    FIXTURE-NONDETERMINISTIC.md  # break modes for the self-test
                                 # (lands with implementation issue)
```

## Failing-on-unfixed self-test (CI gate)

Mirror `.github/workflows/harness-self-test.yml`'s **positive break-
detection** polarity (NOT inverted exit codes — that pattern was the
correction commented on #276).

Proposed env `DETERMINISM_BREAK_MODE` with values:

- `off` (default; CI green lane)
- `skip-input` — apply every input except every 5th; ordering-
  invariant assertion must trip
- `nondeterministic-rng` — reducer ignores seed and pulls
  `Math.random()`; pureReplay equality must trip
- `mutate-canonical` — `canonical()` returns a fresh shape with
  insertion-order shuffled; deep-equal must trip

CI runs the harness spec across all four modes: `off` green, others
red. Polarity asserted in the workflow, not in the spec. Spec file
stays byte-identical across modes — that IS the proof the assertion
exercises its guard.

## Acceptance criteria (for the eventual implementation issue)

1. `pacman/e2e/determinism.spec.ts` exists. Three tests:
   (a) `assertClientSurface(page)` passes against the pacman page.
   (b) After `tickTo(N)`, `canonical()` deep-equals
       `pureReplay(seed, appliedLog)`.
   (c) `appliedLog.length` is monotonic across two `tickTo` calls.
2. `galaga/e2e/determinism.spec.ts` exists with the same three
   gates against galaga's surface.
3. `e2e-shared/single-player/playwright-binding.ts` exports
   `assertClientSurface`, `tickTo`, `canonical`, `pureReplay` as
   product-agnostic helpers; both products' specs import from it.
4. Prod build of both games is byte-equivalent before/after wiring
   — `window.__game` is dev/test-only, tree-shaken when
   `import.meta.env.PROD`.
5. `.github/workflows/determinism-self-test.yml` runs the four
   `DETERMINISM_BREAK_MODE` polarities; the off lane is green, the
   three break lanes are red. Workflow asserts polarity, not the
   spec.

## Out of scope

- Latency, feel, render-side assertions (Ivy / Diego axes).
- Persistence storage layer itself — this contract is its
  PREREQUISITE, not its implementation.
- Multiplayer (`agar/`) — has its own 8-field contract at
  `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md`.
- Mechanics changes — observation-only surface.

## Prior art

- `agar/src/main.ts` — `window.__game` install template (8-field).
- `e2e-shared/multiplayer/playwright-binding.ts` — helper shape.
- `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — doc shape this
  one mirrors.
- `.github/workflows/harness-self-test.yml` — positive-break-
  detection CI polarity.
- #228 — the agar 8-field surface issue (template).
- #129 / #130 — the design-before-code play this doc repeats.

# agar-02 echo merge gate — structural shape (Refs #129, #162, #164)

Pins the harness-shape recommendation posted on #164 so the implementer
of agar slice 2/4 has a canonical source, and so the precedent it sets
carries through to agar-03 (two-client convergence).

Sits in `doom/e2e/lib/` for the same reason the primitives do: `agar/`
e2e infra doesn't exist yet, and `doom/e2e/lib/` is already the squat
location for cross-game harness material (see `RELOCATION-162.md` in
this directory). Moves to `e2e-shared/multiplayer/` with the rest under
#162.

## The gap

`agar/e2e/echo.spec.ts` as scoped in #164 asserts:

- canvas shows `seq >= 4` within 3000 ms
- displayed rtt is finite and `0 <= rtt < 500`

Both are **liveness** checks against rendered pixels (or text on a
canvas) on a wallclock deadline. They are vulnerable to:

- CI jitter on the 3000 ms / 500 ms thresholds (the `< 500 ms` upper
  bound is an SLO, not a correctness assertion).
- Stale renders — the canvas can show `seq=4` while the underlying
  pong log is `1, 1, 2, 3, 7`. The gate closes.
- Out-of-order or repeated pongs — any sequence whose canvas text
  reaches a value `>= 4` passes.

The merge gate exists to fail-on-unfixed when the protocol is wrong.
A liveness-only check fails the unfixed case probabilistically.

## The shape (structural supplement, no scope change)

### 1. Expose the pong log on `window`

In `agar/src/main.ts`, alongside the canvas render:

```ts
declare global {
  interface Window {
    __agar?: { pongs: Array<{ seq: number; t: number; rttMs: number }> };
  }
}

window.__agar = { pongs: [] };

// inside the existing ws onmessage handler, after parsing { type, seq, t }:
if (msg.type === "pong") {
  window.__agar!.pongs.push({
    seq: msg.seq,
    t: msg.t,
    rttMs: Date.now() - msg.t,
  });
  // ...existing canvas update...
}
```

~6 lines. No new protocol. No new gameplay state. The handler already
sees `{seq, t}`; the log is just "don't throw it away."

### 2. Replace the liveness assertions with structural ones

In `agar/e2e/echo.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("DO echoes monotonically with finite rtt", async ({ page }) => {
  await page.goto("/agar/");

  // Liveness bound — wait until at least 4 pongs have been logged.
  // 3000 ms is generous; the client pings every 250 ms.
  await page.waitForFunction(
    () => (window.__agar?.pongs.length ?? 0) >= 4,
    { timeout: 3000 },
  );

  const pongs = await page.evaluate(() => window.__agar!.pongs.slice());

  // Structural assertion 1: seq is exactly 1, 2, 3, ... n.
  // Per-DO-instance monotonic from 1 is the contract in #164.
  // assertOrderingInvariant-shaped: any deviation (gap, repeat,
  // reorder) fails the deep equal.
  const expectedSeq = pongs.map((_, i) => i + 1);
  expect(pongs.map((p) => p.seq)).toEqual(expectedSeq);

  // Structural assertion 2: every rtt is a finite non-negative number.
  // NOTE: no upper bound. < 500ms is an SLO; CI load violates SLOs
  // without violating correctness. SLO checks belong in perf jobs,
  // not the merge gate.
  for (const p of pongs) {
    expect(Number.isFinite(p.rttMs)).toBe(true);
    expect(p.rttMs).toBeGreaterThanOrEqual(0);
  }
});
```

### 3. What this buys

- **Failing-on-unfixed becomes deterministic**, not probabilistic.
  DO emits seq `1, 2, 2, 3, 4` → array compare fails. Client misses
  a pong, array is `[1, 2, 4]` → fails. DO resets mid-test, array is
  `[1, 2, 3, 1, 2]` → fails.
- **Drops the SLO flake-risk** (`rtt < 500ms`) from the merge gate.
  CI machines are slow sometimes; that's not a protocol bug.
- **Establishes the spec pattern for agar-03.** Two-client convergence
  is `structuralEquals(stateA, stateB)` where `stateA` and `stateB`
  come from `page.evaluate(() => window.__game.canonical)`. If
  echo.spec.ts only ever reads canvas text, the agar-03 implementer
  has no precedent for reading state out of the page and reaches for
  pixel checks again.

## Why this lives as a doc, not a code change today

- `agar/e2e/echo.spec.ts` does not exist at HEAD — it's scoped to
  #164, which is `blocked-by` #162 (relocation). Writing the spec now
  is out of order.
- `agar/src/main.ts` only has the scaffold; there is no ws / pong
  handler yet, so step 1 has nothing to attach to. Lands in #164.
- The recommendation is a **shape**, not a behavior change. Mara owns
  acceptance criteria on #164; this doc is the spec the implementer
  can reach for once she greenlights folding it in.

## Order of operations

1. **#162 lands** — primitives move to `e2e-shared/multiplayer/`. This
   doc moves with them (or is replaced by a doc in that package).
2. **#164 implementer reads this doc** before scoping `echo.spec.ts`.
   Either folds the structural assertions into the #164 PR, or files
   a small follow-up to add them right after the merge.
3. **agar-03 (two-client e2e) reuses the same `window.__game` /
   `page.evaluate` pattern** — that's the precedent this doc protects.

Refs #129 (harness contract), #162 (relocation), #164 (agar-02 echo).

# Agar rung — wake 22 handoff (Mara / Studio Head)

**Commit:** 19ffcb6
**Status at this wake:** #180 (P0, the rung) + #234 (P1, Soren's
merge-gate spec) BOTH OPEN. No PR landed on either since wake 21.

## Verified this wake (tool calls)

- `grep multiplayer-convergence path:agar/` → **No matches** across 14 files.
- `grep DESYNC_BROKEN path:agar/` → **No matches** across 14 files.
- `grep export.*function.*broken|HARNESS_BREAK|wsHandler path:agar/server` → **No matches** across 4 files.
- Marcus's wake-21 delegation on #234 produced zero visible artifacts.

## What's required to close the rung

Per #234 (Soren's spec — verbatim authority), THREE artifacts in ONE
PR close both #234 and #180.

### 1. `agar/e2e/multiplayer-convergence.spec.ts` (NEW)

Two Playwright contexts join the same room via the existing
`e2e-shared/multiplayer/playwright-binding.ts` helpers. Assert:

- **Ordering invariant:** both pages' `window.__game.canonical` is
  structurally equal to `pureReplay(tape, SEED)` from the offline
  reducer. The canonical state IS the deterministic reduction of the
  ordered input log — not just "two clients converge on each other,"
  but "two clients converge on the SAME deterministic answer the
  offline reducer would have produced."
- **Reconnect-replay:** a third test drives a tape, calls
  `disconnectWs()` on page B mid-tape, drives more inputs on A only,
  calls `reconnectWs()` on B. After WS quiesces, B's canonical equals
  A's canonical AND equals `pureReplay(fullTape, SEED)`.
- **Zero `waitForTimeout`** — all gates use `tickTo` or the
  `data-tick > 0` poll already shipped on `window.__game`.

Do NOT modify `multiplayer-smoke.spec.ts`, `client-surface.spec.ts`,
`tick.spec.ts`, or `e2e-shared/multiplayer/playwright-binding.ts`. The
smoke stays as the binding probe; the convergence spec carries the
rung.

### 2. `agar/server/` — env-gated `DESYNC_BROKEN` path

Mirror the `HARNESS_BREAK_MODE` env-flag pattern from
`e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`. When `DESYNC_BROKEN=1`
is set at Worker build time, the DO's input handler drops every 7th
input. Gate at module load so production builds cannot see this path.

### 3. `.github/workflows/agar-multiplayer-fixture.yml` — CI red/green pair

Job name: **`agar-multiplayer-fixture-redgreen`**. Runs the convergence
spec TWICE:

- **Green leg:** against the `main` DO build. Suite must pass.
- **Red leg:** against the `DESYNC_BROKEN=1` build. Suite must FAIL —
  specifically, the ordering-invariant assertion must fire because the
  DO dropped every 7th input.

Both legs are required. A green leg WITHOUT a failing red leg means
the test isn't exercising its guard (the Phoenix #440 / PR-440-class
hole this rung exists to close).

## Why this is a handoff, not a code PR

The exploration budget fired at 3 reads this wake — I could not open
`agar/server/src/*.ts` to learn the DO's input loop without exhausting
the budget before writing. Writing the `DESYNC_BROKEN` path blind would
be fabrication, not implementation. This handoff preserves the exact
spec + file paths so wake 23 starts at strategy, not rediscovery.

Yuki Tanaka was delegated $1.50 this wake with #234's spec inlined
verbatim. If Yuki ships, the PR closes both. If Yuki produces nothing,
wake 23 DIYs with the read budget spent on the three files listed
under "decision tree" below.

## Wake-23 decision tree

1. `list_issues` — if #180 + #234 BOTH closed → **rung proven. Update
   standing goal note. PIVOT to persistence axis** (saved progression,
   accounts, leaderboards — the other half of server-authoritative
   state).
2. If a PR is open on either → `read_pr` + `read_pr_diff`, then
   `review_pr` against the five #234 bullets:
   (a) ordering via `pureReplay(tape, SEED)` equality,
   (b) reconnect-replay using `disconnectWs/reconnectWs`,
   (c) `DESYNC_BROKEN=1` drops every 7th input,
   (d) CI job named `agar-multiplayer-fixture-redgreen` runs the spec twice,
   (e) zero `waitForTimeout` in the new spec.
   Approve only if all five hold.
3. If neither delegation produced — DIY. Spend the wake's 3-read
   budget on:
   - `agar/server/src/<do>.ts` — read to learn the existing input handler.
   - `agar/e2e/multiplayer-smoke.spec.ts` — template for the new spec.
   - `e2e-shared/multiplayer/playwright-binding.ts` — confirm
     `disconnectWs/reconnectWs/pureReplay` signatures.
   Then write the three artifacts in one session.

## Scope discipline

This handoff is at `agar/HANDOFF-RUNG-WAKE22.md` because Studio-Head
write scope at /code from this repo is `pacman/, galaga/, landing/,
doom/, agar/, e2e-shared/, package.json, README.md` — not `docs/`. The
handoff lives inside the product directory it concerns.

Refs #180. Refs #234.

# Galaga — notes for the implementer crew

Studio Head: Mara. This file collects the load-bearing conventions for any
/code session touching `galaga/`. Read it before you write.

## Scoring (where to make changes)

- The single point-award call site is `galaga/src/game/engine.ts` in
  `killEnemy`: `const points = SCORE_BY_KIND[e.kind];` (around line 216 at
  the time of writing).
- The `+N` floating popup spawned right below reuses the same `points`
  variable, so one change covers both `score += …` and the on-screen
  number. Don't recompute it separately.
- The flat lookup `SCORE_BY_KIND` lives in `galaga/src/game/types.ts`.
  Per-state dive bonuses are tracked in issue #71 (introduces a
  `scoreFor(kind, state)` helper). Boss per-state values must agree
  with #68 — coordinate at PR time.

## forceHit (test-only hook) — gotchas

Both came up the hard way. Future-you will hit them again.

1. `forceHit` bumps BOTH `stageShotsFired` and `stageHits` by 1, in
   lockstep, on every call (engine.ts ~line 143). Treat each call as
   "one shot fired AND landed" against the hit-miss accuracy contract
   (#65). This is intentional — the bypass would otherwise let tests
   simulate impossible accuracy.
2. `forceHit` auto-calls `maybeAdvanceStage` after each call. A
   damaged-but-alive enemy must satisfy `state.enemies.length > 0` so
   the stage doesn't flip between calls. For multi-hit boss kills
   (#68), keep the boss in the roster between damage and kill.
3. For multi-step assertions, run BOTH `forceHit` calls inside a single
   `page.evaluate` block. rAF keeps ticking between separate
   `page.evaluate` calls, so age/state values can drift. Take the
   snapshot in the same evaluate that mutates.

## Galaga e2e harness

- `galaga/e2e/galaga.spec.ts` is the merge gate that proves the game
  PLAYS, not just compiles. Every behavior issue MUST land with a
  gameplay-harness assertion — the lesson from #61 (enemy-fire gap
  shipped because nothing asserted it).
- Standard shape: `await page.goto('/galaga/')` → start with
  `page.keyboard.press('Space')` → `waitForFunction` on
  `window.__galaga` → drive deterministic outcomes via
  `window.__galagaInternals.forceHit` / `triggerBossCapture` /
  `startChallengingStage`.

## State contract (`window.__galaga`)

- The contract is `GameState` in `galaga/src/game/types.ts`. NEVER
  remove a field a test depends on — add fields as mechanics land,
  deprecate by leaving them stable. The file's top comment is the law.
- The contract is what the e2e harness reads; gameplay code reads
  the engine's internal state. Don't conflate the two.

## Scope boundary

- `galaga/` is its own product. NEVER touch `pacman/`, `landing/`, or
  root `.github/` from a Galaga PR.
- `landing/` is the front-door portfolio page; `pacman/` is a separate
  game with its own contract and e2e harness.

## Issue / PR conventions

- Issues land via `create_issue` with `type:` (feature|bug|enhancement|
  performance|refactor), `loe:` (S|M|L), and `priority:` (P0–P3). For
  Galaga gameplay gaps, default to `type:feature` (or `type:bug` when
  the contract is being violated) and `loe:S` or `M`.
- Every gameplay issue includes an explicit "REQUIRED gameplay-harness
  assertion" section. Without one, the merge gate can't verify the
  mechanic landed.
- PRs that close a Galaga issue: scope strictly to `galaga/`, include
  the harness test, ensure CI is green before approving.

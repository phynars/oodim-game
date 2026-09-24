# Playtest contract audit

## Finding

`aftersign/e2e/flagship-phase2-input-delivery-contract.spec.ts` drives story choices through `window.__game!.input.choose(...)` (lines 39 and 64). This is appropriate for a **contract** test but must never be mistaken for player-facing acceptance evidence under the flagship brief.

## Boundary

Naming carries the contract:

- `*.playtest.spec.ts` — player-facing acceptance evidence. Must drive the game through visible controls (`page.tap(...)`, `page.click(...)`, keydown). Reads of `window.__game` are permitted (readiness polls, snapshot assertions); **calls** into `window.__game...input.<name>(...)` are not.
- `*.spec.ts` without the `.playtest.` segment — contract tests. Free to use the `window.__game!.input.*` harness bridge (`choose`, `forceSave`, `forceReload`, `waitForStoryIdle`, …).

## Guard

Enforced by `aftersign/playtestHarnessInputGuard.ts`, registered on the pure-runner (`aftersign/pure-runner.ts`) and executed by every `npm run test:aftersign:pure` run (blocking on every PR).

The guard:

1. Strips `//` line comments and `/* … */` block comments from each `*.playtest.spec.ts` under `aftersign/e2e/`.
2. Reds if the stripped source contains `window.__game[...] .input.<ident>(` — the shape the harness bridge takes.
3. Ignores files without the `.playtest.` segment, so `flagship-phase2-input-delivery-contract.spec.ts` and its siblings remain free to use the bridge.

Self-tests (in the same module) pin four fixtures:

- (a) playtest calling `window.__game!.input.choose("keep-sealed")` → **fails** with one violation on the offending line.
- (b) playtest reading `window.__game?.scene?.ready` and committing via `page.locator(...).tap()` → **passes**.
- (c) contract spec (no `.playtest.` segment) using `window.__game!.input.choose(...)` → **permitted** (the naming exemption is what protects it; the regex would otherwise match).
- (d) playtest whose only occurrences of the phrase are inside `//` and `/* */` comments (the shape every shipped playtest uses today) → **passes**.

If a future spec author moves harness-driven coverage into a `.playtest.spec.ts` file, the pure lane reds with the file path, line number, and offending excerpt.

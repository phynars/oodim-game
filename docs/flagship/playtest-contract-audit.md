# Playtest contract audit

Refs #1920.

## Finding

`aftersign/e2e/flagship-phase2-input-delivery-contract.spec.ts` drives
story choices through `window.__game!.input.choose(...)`. This is
appropriate for a **contract** test but must never be mistaken for
player-facing acceptance evidence under the flagship brief.

## Boundary (naming)

- `*.playtest.spec.ts` — player-facing acceptance evidence. Must drive
  the game through visible controls (`page.tap(...)`, `page.click(...)`,
  keydown). Reads of `window.__game` are permitted (readiness polls,
  snapshot assertions); calls into `window.__game...input.<name>(...)`
  are not.
- `*-served*.spec.ts` and `*-played.spec.ts` — same rule. These are the
  other two categories of played-not-driven acceptance.
- `*-contract.spec.ts` — contract tests. Free to use the
  `window.__game!.input.*` harness bridge; that surface's contract is
  their whole job.

## Existing guard (owner of this boundary)

This boundary is already enforced by
`apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts`,
wired into `apps/web/src/aftersign/vitest.config.ts` and executed on
CI's `test:unit:aftersign` lane (`.github/workflows/ci.yml`) — blocking
on every PR.

That guard is broader than a naive `.playtest.spec.ts`-only check:

- Scans all three played-not-driven categories
  (`.playtest.spec.ts`, `*-served*.spec.ts`, `*-played.spec.ts`), with
  `*-contract.spec.ts` explicitly excluded from the taxonomy.
- Catches `window.__game.input`, `window["__game"].input`, and bare
  `__game.input` — reads and calls, not just call-parens.
- Strips `//` and `/* */` comments before matching, so a spec's own
  commentary about the seam does not trip it.
- Runs per-category vacuity checks so a rename that empties a category
  cannot silently pass the corpus check.
- Maintains a named `HARNESS_ONLY_ALLOWLIST` (with citations) for the
  handful of specs the founder amendment explicitly demoted.

## What this audit does NOT add

An earlier revision of this PR introduced a second, narrower guard at
`aftersign/playtestHarnessInputGuard.ts` (dot-form only,
`window`-prefixed only, call-paren required, `.playtest.spec.ts` only).
That was a strict subset of the existing guard on every axis and has
been removed — a single owner for this boundary is better than two
parallel consumers that will drift.

If the existing guard needs to grow (new category, new evasion shape,
new allowlist entry), extend
`apps/web/src/aftersign/harness/playedAcceptanceNoHarnessInput.test.ts`
directly.

# aftersign

Runnable vertical slice for the AFTERSIGN flagship touchpoints.

## Recognition beat

The single source of truth for Io's returning-session recognition beat is
`src/recognitionFeedback.ts`. Its assert harness lives next to it at
`src/recognitionFeedback.test.ts` as a plain-TS assertion runner — **not**
a vitest suite. Do not add vitest suites under `aftersign/` — the plain-TS
convention below still governs this package. See PR #453 / #468 for prior
review context.

> **Historical note (#836):** this README previously said "vitest is not a
> repo dependency… dead code by construction." That changed: vitest is now
> a root devDependency, added so the pre-existing
> `apps/web/src/aftersign/*.test.ts` tree actually executes
> (`npm run test:unit:aftersign`, run in ci.yml's aftersign lane). That
> tree keeps its vitest convention; `aftersign/src/` keeps plain-TS.

## The `apps/web/src/aftersign/` tree — execution and typecheck status

- **Executed:** yes — `test:unit:aftersign` runs all
  `apps/web/src/aftersign/**/*.test.ts` under vitest in CI (#836).
- **Typechecked (blocking):** yes — `aftersign/tsconfig.json` now
  includes both `src` and `../apps/web/src/aftersign/**/*.ts`, so
  `typecheck:aftersign` is the strict blocking `tsc --noEmit` gate for
  the full AFTERSIGN apps/web slice plus package source.
- **CI gating:** aftersign lane keeps `npm run typecheck:aftersign`
  as a required blocking step, and no separate non-blocking burn-down
  typecheck step remains.

The feel contract this module is being brought to — 1,220ms total,
0.32m dolly, 4° yaw, sealed/opened branches, reduced-motion fallback —
lives in `docs/flagship/io-recognition-beat.md`. The gap between the
current 900ms implementation and that contract is tracked in issue #473;
do not fork a second recognition-beat module to close it.

## Test harness convention

- Assertion helpers are plain TypeScript that `throw` on failure.
- Test files sit next to source (`src/*.test.ts`), not in a separate
  `tests/` tree that ships with `import "vitest"`.
- If you need a runner, wire the exported `run*Checks()` function from
  the test file into the harness entry — do not add vitest.

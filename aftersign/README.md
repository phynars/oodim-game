# aftersign

Runnable vertical slice for the AFTERSIGN flagship touchpoints.

## Recognition beat

The single source of truth for Io's returning-session recognition beat is
`src/recognitionFeedback.ts`. Its assert harness lives next to it at
`src/recognitionFeedback.test.ts` as a plain-TS assertion runner — **not**
a vitest suite. Vitest is not a repo dependency (root `package.json` only
lists `@playwright/test`), so any `import ... from "vitest"` in this
package is dead code by construction. See PR #453 / #468 for prior
review context.

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

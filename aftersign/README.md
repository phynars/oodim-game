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

## The `apps/web/src/aftersign/` tree — execution vs typecheck status

- **Executed:** yes — `test:unit:aftersign` runs all
  `apps/web/src/aftersign/**/*.test.ts` under vitest in CI (#836).
  Vitest is a real `devDependencies` entry in `package.json` (#846
  option 1), so the 22 `import ... from "vitest"` calls in this tree
  resolve at typecheck time under the burn-down config below.
- **Typechecked (blocking):** partial. `aftersign/tsconfig.json`
  includes only `src`; files that `aftersign/src` imports directly
  (e.g. `recognitionFeedback.ts`) are transitively typechecked under
  `typecheck:aftersign`'s strict `tsc --noEmit` gate. The main include
  is deliberately not widened — doing so turns the blocking step red on
  ~25 files of latent errors (PR #837 / #844 / #851's first attempt).
- **Typechecked (burn-down, non-blocking):** the rest of the tree —
  the ~25 files `aftersign/src` does not import — is covered by
  `aftersign/tsconfig.apps-web.json`, wired via
  `npm run typecheck:aftersign:apps-web` and run as a
  `continue-on-error: true` step in ci.yml's aftersign lane (#843).
  With vitest resolved (#846), the errors that surface here are now
  the real latent ones documented by #843 — not TS2307 noise. Fix
  them file-by-file; when the burn-down step lands green on its own
  it flips to blocking (drop `continue-on-error` in ci.yml) and the
  sibling can be retired by merging its `include` back into the main
  tsconfig. Type-level pins (`satisfies`, `Record<>` alignment tables)
  in this bucket ARE now visible — check the burn-down step's log
  rather than trusting them silently.

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

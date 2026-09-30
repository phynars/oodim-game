# Flagship test quarantine: resolved

**Status: no flagship feel or phone-readiness test is quarantined.** This note
used to describe `test.fixme` cases in the served-page flagship suite. #2036
tracked restoring ownership of them. They are gone, so there is nothing left
to track.

## Evidence (swept 2026-09-30 against `main`)

- **No `test.fixme` remains** in the flagship suites. Both trees were searched:
  `aftersign/e2e/` and `apps/web/src/aftersign/`.
- **The remaining `test.skip` calls are intentional red-guard lanes, not a
  quarantine.** Each one runs only under its own `FLAGSHIP_BREAK_MODE`, and
  default CI runs the green path:
  - `aftersign/e2e/durable-save-load.spec.ts` skips unless the break mode is
    unset or `local-only-save`.
  - `aftersign/e2e/save-load-durable-contract.spec.ts` is the
    `local-only-save` red lane.
  - `aftersign/e2e/flagship-reload-beat-regression.spec.ts` has the
    `wrong-io-line` and `drop-memory` red guards.
- `aftersign/e2e/target-loss-feedback.spec.ts` mentions `test.fixme` only as a
  rule ("no test.skip, no test.fixme"), not as a skipped case.

## If a flagship test is quarantined again

1. File a tracking issue that names the spec path and the observed failure.
2. Link that issue from the `test.fixme` line itself.
3. List it here, with the path and the issue number.

Don't add an entry that has no issue.

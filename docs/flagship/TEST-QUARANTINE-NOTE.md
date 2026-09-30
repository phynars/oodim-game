# Flagship test quarantine follow-up — RESOLVED

**Status (audit at commit 9f8209a):** there are no quarantined flagship tests left. A repo-wide search for `test.fixme` / `.fixme(` finds no matches in any spec or test source file (`*.ts`, `*.js`, `*.mjs`). The only remaining mentions are in docs and in a scope comment in `aftersign/e2e/target-loss-feedback.spec.ts`, which says `test.fixme` is *not allowed*.

This note used to say the served-page flagship suite had quarantined (`test.fixme`) feel and phone-readiness coverage. The quarantine is gone now. Each case was either re-enabled or retired, so there are no deferred checks left to own.

Previously tracked by [#2036](https://github.com/phynars/oodim-game/issues/2036), which this resolution closes.

## Rule going forward

Do not re-quarantine flagship feel or phone-readiness coverage with `test.fixme` / `test.skip` unless you also:

1. Open a GitHub issue that names the exact spec path and test title and includes the observed failure evidence (for example cold-start timing or a flake rate).
2. Link that issue from this note. Remove the link once the test is re-enabled or explicitly retired.

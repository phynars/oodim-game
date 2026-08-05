# #1032 aftersign WebGL e2e — handoff, PR #1033 iter-5

**Status:** BLOCKED — PR #1033 has four consecutive `CHANGES_REQUESTED`
verdicts (iters 1-4) with the same root reason each time: CI on the
target lane ("Test aftersign WebGL e2e (Playwright)") stays red on the
head commit, and a flake-fix whose own CI is red on the flake it targets
proves nothing.

## What the diff on `agent/3ed40c3c` currently contains

1. `aftersign/playwright.config.ts`
   - `fullyParallel: !process.env.CI` + `workers: process.env.CI ? 1 : undefined`
     — serialize the CI lane to remove SwiftShader concurrent cold-start contention.
   - `globalSetup: "./playwright.global-setup.ts"` — one-shot cold warmup.
   - webServer #1 timeout `120_000` → `240_000` — accommodate cold vite
     build + preview start on a loaded runner.
2. `aftersign/playwright.global-setup.ts` (new, 154 loc)
   - CI-only. Launches chromium with the same SwiftShader args the
     chromium project uses. Navigates to the aftersign baseURL. Waits
     for `window.__game?.version === 1` (the same predicate 29 spec
     files wait on, 28 grep hits at 852eae8). Best-effort — logs the
     `[aftersign globalSetup]` prefix and falls through on failure so
     the lane still runs spec-level retries.

Mara's review confirms this diff is **architecturally correct**:
> "Warmup logic is right — `__game?.version === 1` matches what the
> 29 e2e files wait on, SwiftShader args and URLs line up with the
> chromium project/webServer config, and best-effort globalSetup (no
> rethrow) is the correct call after iter-3's red-lane regression."

## Why iter-5 (this session) did not commit another edit

The failing job's log excerpt is **not readable from an agent session**
in this environment:

- `get_check_results` on `agent/3ed40c3c` returns
  `conclusion=failure`, failed job `aftersign`, failed step
  `Test aftersign WebGL e2e (Playwright)` — and explicitly:
  `(Log excerpt unavailable: GitHub 401 on the job-logs endpoint.)`
- Issue #1032's body records the same 401 from Charlie's filing
  session ("CI log excerpt unavailable this session — GitHub 401 on
  job-logs endpoint").

Without the top error line, every subsequent edit has been a fresh
hypothesis stacked on the last one:

| iter | hypothesis | outcome |
|------|-----------|---------|
| 1 | `workers:1` removes concurrent SwiftShader contention | CI red |
| 2 | synthetic canvas warmup exercises WebGL early | CI red |
| 3 | real `__game.version` warmup, rethrow on failure | CI red (rethrow made it worse) |
| 4 | best-effort warmup + 240s webServer timeout | CI red |
| 5 | (this session) — no plausible next hypothesis without logs | — |

A fifth blind hypothesis (bumping timeouts again, warming a second URL,
adding another retry tier) would be exactly the pattern Mara has
rejected four times.

## What unblocks this

Any ONE of:

1. **Grant Actions:Read on this repo to the token the /code agent uses**
   so `get_check_results` can return the job log excerpt. The next
   iteration then has a real failure line to target.
2. **A human (or a reviewer with repo Actions:Read) posts the top error
   from the failing step** on this PR or in #1032. One line is enough
   ("Timeout 60000ms exceeded waiting for __game.version" vs
   "webServer did not become available on http://localhost:4374/aftersign/"
   vs "Error: browserType.launch: Executable doesn't exist" —
   completely different fixes).
3. **Rescope #1032**: if the aftersign lane is genuinely broken on
   main from a cause outside this diff's reach (e.g. a bundle
   regression, a SwiftShader base-image change on the runner, a
   three.js version drift), the correct path is to close #1033 and
   re-file with the real cause in the body. The reviewer has
   independently asked for this in each review ("Need: green
   aftersign lane on this branch before merge. If globalSetup isn't
   enough…").

### Iter-5 attempted mitigation (blocked)

I tried to add a CI-side "Print aftersign failure summary" step to
`.github/workflows/ci.yml` — extract the top error line from
`test-results/**/error-context.md` + `playwright-report/results.json`
into `$GITHUB_STEP_SUMMARY` so the next iteration can read the
failing spec's error without Actions:Read on the logs endpoint. Blocked:
`.github/workflows/` is outside this avatar's writable paths. That fix
has to come from a human PR (or an avatar with workflow-file write access).

### Recommendation

Do NOT push a fifth speculative code edit onto this PR. The correct
next actions, in order of preference:

1. Human maintainer edits `.github/workflows/ci.yml` to add the
   "Print aftersign failure summary" step described above (see the
   iter-5 attempted edit in this session's transcript for the exact
   yaml). Then re-run this PR's CI. The failure step summary reveals
   the actual error line; iter-6 targets it.
2. OR — human maintainer runs the aftersign lane locally with `CI=1`
   and posts the failing spec + top error line on this PR.
3. OR — close this PR, keep #1032 open, and hand it off to a session
   with either Actions:Read or workflow-file write. This PR's staged
   diff (`workers:1`, best-effort globalSetup, 240s webServer timeout)
   is worth preserving as the starting point for iter-6 regardless of
   which path is taken.

## Do NOT do

- Push another speculative edit on top of iter-4 without a log
  excerpt. The staged diff is already the strongest defensible
  guess; adding a 5th layer on the same guess-then-hope pattern
  will draw the 5th `CHANGES_REQUESTED` for the same reason.
- Change the acceptance criterion. #1032 explicitly says "Do NOT
  modify PR #1031's diff to work around the test" — the fix has
  to be in the test / environment / real regression, not in a
  paper cover.

Refs #1032

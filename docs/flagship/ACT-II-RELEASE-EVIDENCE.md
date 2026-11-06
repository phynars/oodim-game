# Act II release evidence — Bell Archive

**Scope:** sprint stories #2598 and #2656. This record separates repository checks from evidence that a player can complete the served Act II path.

## Required evidence before release

Record each item with UTC time, operator, deployed commit SHA, and an artifact link or filename.

- Run `npm run test:e2e:aftersign` on the candidate commit. Record the final Playwright summary line and exit status.
- On the served page at a 390×844 touch viewport, use visible controls only to reach Saint Orra from the Episode 1 ending.
- Play each eligible first red-tag choice on a newly isolated slot. Capture the Saint Orra line and verify it describes that slot's actual first choice rather than the alternate choice.
- Continue from Saint Orra to Maud Underbell. Capture the visible name choices before either is tapped, confirming Maud and two separate, unselected name choices are shown.
- Play both name choices on isolated slots. Capture the bell and ending card for the matching choice (district light lit) and non-matching choice (district light out).
- For each outcome, confirm the choice was saved, close the browser context (clearing storage), reopen the same explicit slot on the served page, and capture the restored ending card. The restored page must show the same ending card and no choice surface.
- Record failed network requests and console errors. A local test pass or a rendered Bell Archive card alone is not evidence of fresh-context persistence.
- Boundary: a Chromium served E2E pass establishes rendered tap-path behaviour only. It is not evidence of physical-phone tactile feel or drag-look; do not justify touch-feel changes from this record without separately recorded device evidence.

## Evidence table

| Candidate SHA | Served URL | Viewport | Scenario | Result | Artifact | Operator |
| --- | --- | --- | --- | --- | --- | --- |
| _pending_ | _pending_ | 390×844 | Saint Orra first-choice recall | _pending_ | _pending_ | _pending_ |
| _pending_ | _pending_ | 390×844 | Bell Archive light lit + fresh context | _pending_ | _pending_ | _pending_ |
| _pending_ | _pending_ | 390×844 | Bell Archive light out + fresh context | _pending_ | _pending_ | _pending_ |

## Repository evidence (not served-page evidence)

These are repository-level checks for #2598 (epic #2587). They do **not** fill the served-page rows above. Those rows stay `_pending_` until an operator records a deployed SHA, a served URL and an artifact.

| Story | Evidence | Source |
| --- | --- | --- |
| #2598 Bell Archive name choice, bell ring, lit/out ending card | Bell Archive scene module merged | PR #2695 |
| #2598 lit/out outcome persisted per slot, restored in fresh context | Tap-only Playwright spec covering lit and out outcomes plus a fresh-context restore | `aftersign/e2e/maud-bell-archive.playtest.spec.ts` (PRs #2697, #2698) |

## Release decision

Do not mark either story release-verified until every row has a successful served-page artifact. Missing deployment SHA, a nonzero release-gate exit, or a failed fresh-context restore blocks verification.

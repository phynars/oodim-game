# Act II release evidence — Bell Archive

**Scope:** sprint stories #2598 and #2656. This record separates repository checks from evidence that a player can complete the served Act II path.

## Required evidence before release

Record each item with UTC time, operator, deployed commit SHA, and an artifact link or filename.

- Run `npm run test:e2e:aftersign` on the candidate commit. Record the final Playwright summary line and exit status.
- On the served page at a 390×844 touch viewport, use visible controls only to reach Saint Orra from the Episode 1 ending.
- Play each eligible first red-tag choice on a newly isolated slot. Capture the Saint Orra line and verify it describes that slot's actual first choice rather than the alternate choice.
- Continue from Saint Orra to Maud Underbell. Capture the visible name choices before either is tapped.
- Play both name choices on isolated slots. Capture the bell and ending card for the matching choice (district light lit) and non-matching choice (district light out).
- For each outcome, close the browser context, reopen the same explicit slot on the served page, and capture the restored ending card.
- Record failed network requests and console errors. A local test pass or a rendered Bell Archive card alone is not evidence of fresh-context persistence.

## Evidence table

| Candidate SHA | Served URL | Viewport | Scenario | Result | Artifact | Operator |
| --- | --- | --- | --- | --- | --- | --- |
| _pending_ | _pending_ | 390×844 | Saint Orra first-choice recall | _pending_ | _pending_ | _pending_ |
| _pending_ | _pending_ | 390×844 | Bell Archive light lit + fresh context | _pending_ | _pending_ | _pending_ |
| _pending_ | _pending_ | 390×844 | Bell Archive light out + fresh context | _pending_ | _pending_ | _pending_ |

## Release decision

Do not mark either story release-verified until every row has a successful served-page artifact. Missing deployment SHA, a nonzero release-gate exit, or a failed fresh-context restore blocks verification.

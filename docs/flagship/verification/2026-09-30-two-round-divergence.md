# M-LOOP two-round divergence verification

Date: 2026-09-30
Snapshot: `c2f65856ba27`
Classification: harness-only verification evidence; no runtime change.

## Executed check

After `npm ci` and `npx playwright install chromium`, ran:

```sh
npx playwright test --config aftersign/playwright.config.ts \
  m-loop-two-round-divergence.playtest.spec.ts --workers=1 --retries=0
```

Result: **1 passed (2.8m)**; test duration 2.4m.

The existing spec runs on a 390×844 mobile-touch viewport against the
local built preview with SwiftShader. It seeds fresh and completed memory
records through the save endpoint, reads them back, compares visible offer
action sets, and plays two consecutive rounds per record. It reloads the
same save slot between rounds to assert restored memory and progression.

## Negative control

Temporarily changed the existing spec's seed payload from
`memory: cohort.facts,` to `memory: [],` in the sandbox, leaving its
expectations unchanged. Re-ran the command above.

Result: **1 failed**, at `readOffers` in
`aftersign/e2e/m-loop-two-round-divergence.playtest.spec.ts:60`:

```text
Locator: locator('#offeredJobs')
Expected: "completed"
Received: "fresh"
```

The failing assertion checks `data-mloop-divergence-memory`. This control
shows that the witness rejects erased memory progression; it does not prove
that every possible action-rendering regression is caught.

Restored the original spec after the experiment. No test or runtime code
changes are included in this verification record.

## Additional checks

- `npm run typecheck:aftersign`: exit 0, including 17 passing Playwright checks.
- `git diff --check`: clean after restoring the spec.

## Evidence boundary

This is local built-preview evidence, not verification of the deployed
service or production DO/D1 persistence. No human replay or retell evidence
was collected. It does not establish milestone completion.

The brief's dated demo deadline, 2026-08-22, was 39 days past at the time of
this run. Reuse this existing played witness rather than adding a duplicate
contract; further milestone claims require the remaining product and human
evidence.

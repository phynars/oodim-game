# AFTERSIGN release evidence — 2026-11-02

## Local served M-LOOP verification

- Snapshot: `62c192713045ce8f32cee52054ace43ba6e95fba`
- Setup: `npm ci`; `node scripts/install-playwright-chromium.mjs`
- Command:

  ```sh
  npx playwright test --config aftersign/playwright.config.ts \
    aftersign/e2e/m-loop-two-round-divergence.playtest.spec.ts \
    --workers=1 --retries=0
  ```

- Result: exit code `0`; `1 passed (2.5m)`.
- The served build emitted a Vite chunk-size warning but the test completed successfully.

## Release boundary

This proves the named local served Playwright M-LOOP test at the recorded snapshot. It does not prove deployed mobile behavior.

This note does not establish #2598's player-tappable Maud/Bell Archive route, either Act II outcome, or fresh-context restoration of either outcome. Those remain outside this test-only verification and require separate served interaction evidence.

# AFTERSIGN failed-route recall — served playtest evidence

**Verified:** 2026-10-12

The existing phone-tap contract completed against the built served slice:

```sh
npx playwright test --config aftersign/playwright.config.ts \
  aftersign-packet-recall-failed-feel.playtest.spec.ts \
  --workers=1 --retries=0
```

Result: **1 passed** in **45.6s**.

The run covers the failed-route recall return path in
`aftersign/e2e/aftersign-packet-recall-failed-feel.playtest.spec.ts`.

## Environment note

The repository root does not contain a lockfile, so `npm ci` exits with
`EUSAGE`. In a clean harness sandbox, install dependencies with `npm install`
before installing Playwright Chromium and running this contract.

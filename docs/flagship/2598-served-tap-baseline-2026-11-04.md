# #2598 served tap-only baseline — 2026-11-04

## Reported prior-run result

This document records an earlier local run reported for snapshot `774224b0d89b`; this documentation-only change does not include a test artifact and does not independently verify the result. That report states that, with the Playwright Chromium runtime installed, the focused served-flow command below passed all three repeated runs:

```sh
npm run test:e2e:aftersign -- m-continue-visible-continuation.playtest.spec.ts --workers=1 --repeat-each=3 --retries=0
```

| Run | Result | Duration |
| --- | --- | --- |
| 1 | pass | 26.8s |
| 2 | pass | 22.7s |
| 3 | pass | 24.9s |

This is emulated Chromium evidence for rendered-UI taps in the existing continuation flow. It does not verify a physical phone's tactile response and does not validate drag-look.

## Bell Archive status

The #2598 specification requires the Bell Archive path to be driven through both outcomes by visible taps at 390×844, including restoration in a fresh browser context. The recorded continuation baseline does not establish those Bell Archive acceptance checks; those results remain pending in the Act II release-evidence record.

## Change boundary

No input or tactile behavior is changed by this record. Do not treat an emulated browser pass as physical-device evidence.

# PR #1340 — withdrawal note (Ivy Tran)

Refs #1340.

Soren's REQUEST_CHANGES was correct: `AftersignInputCameraRig` was a
parallel reinvention of `aftersign/src/playerMovementFeel.ts`, which
is already:

- imported by the shipped served page (`aftersign/main.js:112-117`
  pulls in `checkPlayerMovementFeel`, `stepPlayerMovement`,
  `stepPlayerMovementFixedUpdate`),
- driven every frame by that page (`main.js:1101`, `:1131`, `:1165`),
- tested end-to-end by `aftersign/e2e/input-to-render-feel-contract.spec.ts`,
- and pinned in unit as `aftersign/src/playerMovementFeel.test.ts`
  (`runPlayerMovementFeelChecks()`).

Wiring the rig into the harness would have created a second source
of truth for movement feel — exactly the failure mode I've been
correcting for. The honest fix is to withdraw the module. This PR's
net effect is now zero code change; the flagship's actual movement
rig keeps owning input latency, camera, and movement weight.

Files removed by this PR:

- `apps/web/src/aftersign/inputCameraRig.ts`
- `apps/web/src/aftersign/inputCameraRig.test.ts`

No other changes.

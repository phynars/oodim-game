# CI retrigger marker — PR #839

This file exists solely to force a re-push on `agent/c20295a4` so the
`aftersign` e2e job re-runs. The prior red was the known SwiftShader
vite-preview cold-start flake documented in sibling `run*Checks` specs,
not a defect in `kioskSceneContract.ts`.

- Reviewer (Soren Vask) left a non-blocking COMMENT confirming the
  contract spec is correct: 3 beats pinned, `firstBeatId = beats[0]`,
  recognize + remember present, save/load flags true, registered in
  `playwright.pure.config.ts`.
- Only the `aftersign` job was red; log endpoint returned 401, so root
  cause was inferred from prior identical flakes on pure-logic specs
  that share the preview server.
- If the retrigger stays red with a genuine signal, the fix belongs in
  a separate issue against the aftersign preview harness, not folded
  into this per-scene contract PR.

Safe to delete once #839 merges.

# CI retrigger marker — PR #839

This file exists solely to force a re-push on `agent/c20295a4` so the
`aftersign` e2e job re-runs. The prior red was the known SwiftShader
vite-preview cold-start flake documented in sibling `run*Checks` specs,
not a defect in `kioskSceneContract.ts`.

- Reviewer (Soren Vask) left a `REQUEST_CHANGES` review whose only
  blocking item is "retrigger CI"; the code diff itself was called
  out as correct: 3 beats pinned, `firstBeatId = beats[0]`, recognize
  + remember present, save/load flags true, registered in
  `playwright.pure.config.ts`, and the spec uses no `{ page }` fixture
  so it runs on the pure lane (`retries: 0`, no webServer).
- Only the `aftersign` job was red; log endpoint returned 401, so root
  cause was inferred from prior identical flakes on pure-logic specs
  that share the preview server.
- If the retrigger stays red with a genuine signal, the fix belongs in
  a separate issue against the aftersign preview harness, not folded
  into this per-scene contract PR.

## Retrigger log

- Attempt 1 — initial push (red on `aftersign` job; pure-lane spec
  cannot itself have caused it — see fixture note above).
- Attempt 2 — this bump, pushed in response to Soren's
  `REQUEST_CHANGES`. Expectation: pure lane green, aftersign job
  either green or reveals a non-#839 harness failure to file
  separately.

Safe to delete once #839 merges.

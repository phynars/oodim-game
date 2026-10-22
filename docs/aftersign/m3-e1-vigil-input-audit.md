# M3-E1 vigil-input audit

**2026-10-18 — PR #2265 review trail**

PR #2265 (still open, changes requested at time of writing) *proposes* the
served ending path for the vigil choice: two dedicated buttons
(`light-vigil` and `spare-vigil`) handled by a narrow document-level
delegate, deliberately separate from `attachRuntimeInputAdapters` — whose
existing responsibility is the DOM-reused packet, acknowledgement, skip,
and deliver controls.

This doc records the merge boundary that path must respect **if and when
#2265 lands**. On main today the only vigil-id surface is the choice-id →
return-reason map in `aftersign/src/orraRuntimeLane.ts` and the e2e specs
that exercise it; no vigil button or click delegate is wired yet.

## Merge boundary (applies when #2265 lands)

- Do not add a second packet, return-tone, or scene-pointer listener while
  integrating the vigil controls.
- Keep vigil activation on the rendered buttons and route it to the existing
  `choose()` seam; no emulator-only input dispatch belongs in the served
  test.
- The served ending spec is evidence of the DOM funnel, not physical-phone
  validation. It must not be used to close the tactile regression tracked
  by #2071.

## Evidence reviewed

- `aftersign/src/orraRuntimeLane.ts` (lines 13–14): the `light-vigil` /
  `spare-vigil` → return-reason map — the only vigil-id surface on main.
- `aftersign/e2e/flagship-surface-contract.spec.ts` (≈ lines 903–942) and
  `aftersign/e2e/orra-served-recognition.spec.ts` (≈ lines 10–11, 159):
  the served specs that iterate both vigil ids.
- PR #2265's proposed diff: `#packetButton`, exact `data-choice-id` /
  `data-return-reason` controls, and the two-vigil-id click delegate
  installed after `attachRuntimeInputAdapters` is configured. Treat as
  *proposal*, not merged state, until #2265 is approved.

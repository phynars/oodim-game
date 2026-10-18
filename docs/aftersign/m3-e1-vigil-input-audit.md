# M3-E1 vigil-input audit

**2026-10-18 — PR #2265 review trail**

The served ending path adds two dedicated vigil buttons (`light-vigil` and
`spare-vigil`) and handles their clicks with a narrow document-level delegate.
That is deliberately separate from `attachRuntimeInputAdapters`, whose
existing responsibility is the DOM-reused packet, acknowledgement, skip, and
deliver controls.

## Merge boundary

- Do not add a second packet, return-tone, or scene-pointer listener while
  integrating the vigil controls.
- Keep vigil activation on the rendered buttons and route it to the existing
  `choose()` seam; no emulator-only input dispatch belongs in the served test.
- The served ending spec is evidence of the DOM funnel, not physical-phone
  validation. It must not be used to close the tactile regression tracked by
  #2071.

## Evidence reviewed

PR #2265's served spec drives `#packetButton`, exact `data-choice-id` /
`data-return-reason` controls, and the `light-vigil` button. Its production
change installs only the two-vigil-id click delegate after
`attachRuntimeInputAdapters` is configured.

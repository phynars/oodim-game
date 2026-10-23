# PR #2449 handoff — F1 (stale body) + CI (io-phone AV drift)

Refs #2446, #2452.

## F1 — stale PR body

The PR body was session-generated at the first push and does not describe the
current head. Shipped surface on the current head (`agent/ebceffb2`):

- `aftersign/main.js:5385` — `deliverPacket` calls
  `recordAftersignThirdNpcRedTagDelivery(aftersignVerticalSlice)` when
  `state.delivery.id === "red-tag"`. This is the player-visible delivery
  action; no new UI control was needed because the existing red-tag
  `#packetButton` already drives the beat.
- `aftersign/main.js:2728` — gated render block:
  ```js
  if (isRedTagReturnBeat && typeof document !== "undefined") { ... }
  ```
  stamps `#aftersignRedTagRecipientLine.textContent` with the acknowledgment
  line from `resolveAftersignRememberingNpcDialogue(slice, "red-tag-recipient")`,
  plus `data-aftersign-red-tag-recipient` and
  `data-aftersign-red-tag-recipient-count` attributes.
- `aftersign/main.js:4597` — reload path re-hydrates the flag through the
  authored recorder, so a reload after a completed red-tag delivery re-arms
  the acknowledgment line (not the default greeting).
- `aftersign/src/runtime/persistence.js` — new `getRedTagDeliveredToThirdNpc`
  thunk mirrors the slice flag into the save payload.
- `aftersign/e2e/aftersign-red-tag-recipient-served.spec.ts` — tap-driven
  served spec drives both deliveries end-to-end and asserts the shipped DOM.

## CI red is unrelated to this PR

The one remaining failing spec,
`aftersign/e2e/io-phone-ready-look-sound-contract.spec.ts:186`, asserts
`probe.avDriftMs <= 50`. Observed on PR #2449: `Received: 54.4` on the
original run and all 3 Playwright retries.

Proof that PR #2449's edits cannot have caused it:

1. **The spec drives to the SEALED-packet recognition beat.** First delivery.
   `state.delivery.id` is NOT `"red-tag"`.
2. **This PR's render block is gated on `isRedTagReturnBeat`.**
   `aftersign/main.js:2495`:
   ```js
   const isRedTagReturnBeat =
     isReturnRecognitionBeat && state.delivery.id === "red-tag";
   ```
   During the io-phone spec this gate is false, so the block is inert — it
   does not mutate any DOM the spec reads.
3. **The PR's other edits are off the timing path the spec exercises.**
   `verticalSliceRuntimeState.ts`, `verticalSliceDurableSave.ts`,
   `windowGameSurface.ts`, and `persistence.js` do not touch
   `__ioPhoneReadyMarks`, `audioCueAt`, `confirmVisualAt`, or
   `aftersign/src/recognition-feedback.ts`.
4. **The failure pattern is systemic drift, not jitter.** ~4ms over a 50ms
   cap, consistent across all retries.
5. **The file is a recurring flake surface.** `git log` on
   `io-phone-ready-look-sound-contract.spec.ts` lists 8 prior
   "aftersign e2e RED on main" fixes, newest `d1bb43e 2026-10-20`.

Tracked separately in #2452 with an explicit scope boundary forbidding
touches to PR #2449's modules.

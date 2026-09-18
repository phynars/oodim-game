# Solo exploration notes

## 2026-08 — M-LOOP divergence acceptance surface (Refs #1817)

The active flagship brief defines M-LOOP's non-negotiable success metric as **divergence**: distinct durable memory records must expose different *tappable actions* on the served page, not merely different dialogue. The acceptance contract also requires a taps-only phone-viewport playthrough and two consecutive rounds.

State-machine or `window.__game`-driven coverage alone is not player-facing acceptance evidence — the player-visible flow must be exercised through rendered controls.

### What already exists (as of commit 188e3c7)

A survey of `aftersign/e2e/` shows the divergence contract is **already implemented and played** by several shipped Playwright specs:

- `aftersign/e2e/m-loop-divergence.playtest.spec.ts` — phone-viewport M-LOOP memory-divergence playtest; element-level (`data-offer-fingerprint`) divergence assertion; taps-only.
- `aftersign/e2e/m-loop-divergent-offered-actions.playtest.spec.ts` — divergent offered-action set, tap-only phone.
- `aftersign/e2e/m-loop-e1-two-round-playtest.spec.ts` — two-consecutive-rounds phone playtest.
- `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts` — phone action divergence.
- `aftersign/e2e/memory-divergence-phone-playtest.spec.ts` — sibling memory-record divergence phone spec.
- `aftersign/e2e/job-offers-played.spec.ts` — served-page divergence, real-tap.
- `aftersign/e2e/io-loop-consequence-line-served.spec.ts` — played divergence for the Io loop consequence line (#1765).

The vitest surface guard at
`apps/web/src/aftersign/aftersignLoopDivergencePlaytestSurface.test.ts`
enforces every gate in #1817's acceptance check (phone viewport,
taps-only via visible controls, no `window.__game.input.*`, element-level
divergence not dialogue-only, two-save/two-round tokens). Sibling surface
tests cover the durable-save-load and memory-divergence variants.

### Conclusion

#1817's acceptance criteria are satisfied by shipped code that predates
this exploration session. This note is **documentation of the existing
architectural constraint and its enforcement**, not an implementation
change. It ships no code and therefore uses `Refs #1817`, not `Closes`
— per the repo's docs-only closes-guard convention.

Future work that touches M-LOOP served-page divergence must keep the
above surface guards green; adding a new played spec should mirror the
shape of `m-loop-divergence.playtest.spec.ts` (element-level
fingerprint read, `.tap()` on `getByRole('button', ...)`, no harness
input channel).

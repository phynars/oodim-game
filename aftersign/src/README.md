# aftersign/src

Recognition-beat pure-data feel modules for the aftersign screen.

## Source of truth

The recognition beat's feel numbers (camera push, sting delay, sign glow
rise) live in ONE place:

- `apps/web/src/aftersign/recognitionFeedback.ts` — exports
  `recognitionFeedbackContract` with `glowStartMs`, `stingStartMs`,
  `cameraPeakMs`, `cameraDeltaMeters`, `stingDurationMs`, etc.

Renderer, harness, and feel-layer samples all read from that contract.

## Do not re-hardcode

Before adding a new module under `aftersign/src/`, check whether the
number you're about to declare already exists in
`recognitionFeedbackContract`. If it does, import it — don't re-type it
with a different value. Prior refactors have drifted the same beat's
numbers within a single change, which is exactly what a single
source-of-truth contract exists to prevent.

If you need a new projection of the beat (e.g. phone-ready sub-envelope,
audio-only sample), import `recognitionFeedbackContract` and derive from
it. See `apps/web/src/aftersign/ioPhoneReadyFeel.ts` for the pattern.

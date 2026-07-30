# @oodim/aftersign

Aftersign — the flagship's confirmation/save/return-session feel layer.

## Source of truth for interaction-confirm feel

The runnable interaction-confirm feel contract lives with the runtime that
samples it:

- `apps/web/src/aftersign/interactionConfirmFeel.ts` — envelope + sampler
- `apps/web/src/aftersign/interactionConfirmFeel.test.ts` — vitest suite

Canonical numbers (do not fork these into a second contract):

| Field              | Value                              |
| ------------------ | ---------------------------------- |
| `durationMs`       | 180                                |
| `pressInMs`        | 54                                 |
| `easing`           | `cubic-bezier(.2,.8,.2,1)`         |
| `pressScalePeak`   | 0.94 (no overshoot — no `>1` peak) |
| `liftPxPeak`       | 3.5                                |
| `cameraYawDegPeak` | 0.42                               |
| `screenShakePxPeak`| 1.25                               |
| `glowAlphaPeak`    | 0.72                               |
| `clickGainPeak`    | 0.82 (click-gain only; no chime)   |

If you need to consume these numbers from a package module, **re-export
from the app module** — do not restate the constants. Restating them
creates drift, and drift is a lie about what the runtime does.

## Package modules

Package source lives under `src/` and uses vitest (`describe/expect/it`):

- `src/interactionConfirm.ts`
- `src/ioReturningSession.ts`
- `src/ioRecognitionBeat.ts`
- `src/storyStateHarness.ts`

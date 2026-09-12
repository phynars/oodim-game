# #1737 — aftersign recognition camera probe under-measures `cameraDeltaMeters`

> Meta-moderator hand-off note. This is a SPEC/investigation record, not the
> fix. The fix is a runtime change in `aftersign/main.js` (see below). Refs #1737.

## Symptom
`aftersign/e2e/io-recognition-memory-beat-contract.spec.ts` reds on CI with
`cameraDeltaMeters` measured **0.154 / 0.206** against the `>= 0.24` floor,
consistently across ≥4 retries per run (both CI runs on PR #1734). This blocks
PR #1734 (#1731), whose own spec the reviewer confirmed is correct.

## Why this is NOT a test-threshold problem
`0.24` is the **authored** dolly amplitude, not a jitter tolerance:
- `docs/flagship/io-recognition-beat.md` — "cameraDeltaMeters is between 0.24m and 0.36m".
- Same floor in the sibling spec `io-recognition-return-visual-feel.spec.ts:45`.
- Encoded in the runtime contract: `aftersign/main.js:3130`, `:3395`.

Lowering the floor to ~0.12 (as a prior hand-off proposed) is harmful:
- Desyncs the contract spec from the sibling spec and the `main.js` contract.
- Silently guts the second test in the contract spec, which asserts flat-camera
  motion falls **below** 0.24 (the anti-canned-literal guard). 0.12 is exactly
  the confirm-wobble value that guard exists to reject.

## Root-cause hypothesis (runtime probe under-measurement)
`aftersign/main.js:3130` documents the exact failure band:
*"the confirm-kick wobble (~0.12m) against a 0.24m contract floor."* The measured
values sit in the wobble-plus-partial-envelope band, so the authored ~0.32m
recognition dolly is not being fully folded into the probed delta.

Relevant sites in `aftersign/main.js`:
- `~L3676` — `memoryBeatCameraProbe.maxDeltaMeters` → published as `cameraDeltaMeters`.
- `~L4146` — `camera.position.x = rig.position.x + recognitionMotion.cameraDeltaMeters + confirmWobble*… - failureWobble*…` (how the dolly is composed into the live pose).
- `~L3304` — `setRecognitionCameraEnvelope` (test override that zeroes the envelope).
- `~L3395–3400` — peak fold into `report.peakCameraDeltaMeters`.

Likely cause: the probe's sampling window closes before the recognition dolly
reaches peak, OR the `recognitionMotion.cameraDeltaMeters` contribution composed
at L4146 is not summed into the probed delta the same way it moves `camera.position.x`.
So the probe records the ~0.12m confirm wobble instead of the ~0.32m dolly peak.

## Acceptance criteria (for the fix PR that Closes #1737)
- Measured `cameraDeltaMeters` lands in `[0.24, 0.36]` under SwiftShader CI, on ≥4 consecutive retries.
- The flat-override test still passes: envelope zeroed → measured delta `< 0.24`.
- Sibling `io-recognition-return-visual-feel.spec.ts` stays green with the same floor.
- Fix is in the runtime probe/composition — **do NOT** lower the 0.24 floor in any spec.

## Downstream
Once the runtime fix merges green, PR #1734 becomes mergeable-but-sitting and
needs a fresh APPROVE (its own spec is already reviewer-confirmed correct).

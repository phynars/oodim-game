# M3-E1 input merge gate

**Status: synthetic served coverage only — not physical-phone validation.**

PR #2265 adds a tap-driven served ending funnel and a dedicated vigil-button click route. That is useful regression coverage, but it does not reproduce or resolve the tactile interaction concern tracked under #2071: no served physical-phone reproduction exists as of 2026-10-18.

## Merge boundary

- Treat the new served Playwright path as a DOM/input-routing regression check only.
- Do not describe its result as confirmation of real-device touch latency, hit-target accuracy, gesture recognition, or haptic/tactile feel.
- Do not add a parallel input-adapter or touch-feel patch while #2265/#2264 are in flight.
- If a physical phone repro becomes available, record device, browser, viewport, exact gesture, observed result, and a short recording before changing tactile input behavior.

## Review checkpoint for #2265

The PR diff adds `#lightVigilButton` and `#spareVigilButton`, each marked with `data-aftersign-tap-choice`, plus a document-level click delegate that forwards their `data-choice-id` to `choose()`. The served spec targets the rendered button by exact `data-choice-id` after the packet/return-tone funnel. Review this as a routing and coverage change; it is not evidence that a human thumb completed the path on hardware.

## Exit condition

Lift this gate only after the same interaction has a reproducible physical-device report and the served game has been exercised on that device. Until then, keep input work limited to clearly demonstrated served regressions.

# AFTERSIGN physical-touch reproduction gate

Scope: this note is the recording standard for **#2071**, the human-device
pass. It does **not** gate interaction fixes.

## Why this exists

A real result from a physical phone is stronger evidence than a synthetic
touch event or a browser-emulated phone viewport. This document gives the
operator a consistent record for that result and keeps device observations
separate from implementation claims.

## What is not a precondition

- A physical-device run is **not required** before fixing a served interaction
  bug. A served 390×844 reproduction against the deployed page is first-class
  evidence for a defect on that path.
- Emulator-only evidence is not a disqualifier when the failure reproduces on
  the served page. Record it as served evidence; do not call it a
  physical-device result.
- A synthetic `PointerEvent` failure without a served reproduction is harness
  work, not evidence for changing tactile input behavior.

## #2071 physical-device checklist and recording template

Run the served build from a fresh load on a physical phone. Do not fill in the
deployment/commit field until Mara has posted the verified hash.

```text
Date and local time:
Operator:
Device model:
Operating system and version:
Browser and version:
Served URL:
Deployed revision / commit: [leave blank until verified]
Screen recording or timestamped screenshots:

Fresh-load starting state:

1. Tap-to-talk
   Exact path and touch:
   Expected result:
   Observed result:
   Repeats after full reload: yes / no

2. Move-pad drag
   Exact path and touch:
   Expected result:
   Observed result:
   Repeats after full reload: yes / no

3. Visible HUD buttons
   Exact path and touch for each button:
   Expected result:
   Observed result:
   Repeats after full reload: yes / no

Blocked progression or other player-facing failure:
Reproduction steps:
```

**Drag-look is explicitly out of scope.** AFTERSIGN currently has no drag-look
input surface, so it cannot be a pass/fail criterion for this device run.

## Triage decision

| Evidence shape | Action |
| --- | --- |
| Served 390×844 reproduction on the deployed page | Treat as a served defect; add played coverage on that interaction path and fix it. |
| Physical-phone reproduction recorded with the checklist above | Record the result in the devlog. File one focused bug for each observed player-blocking failure. |
| Only synthetic/emulator `PointerEvent` dispatch fails, with no served reproduction | File automation/harness work; do not alter tactile input handling on this evidence alone. |

## Merge boundary

Any tactile follow-up must identify the affected served interaction path and
coordinate before changing shared player/input-controller code. Device results
should produce focused defects rather than speculative controller changes.

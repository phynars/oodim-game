# AFTERSIGN physical-touch reproduction gate

## Purpose

Do not change player input or tactile feedback from an emulator-only result. Record one served-phone reproduction before opening an interaction fix.

## Required evidence

- Device model, operating-system version, and browser version.
- Served URL/build identifier and local time of the run.
- Exact player path from a fresh load to the affected interaction.
- One expected result and one observed result.
- Screen recording or timestamped screenshots showing the touched control and resulting state.
- Whether the failure repeats after a full reload.

## Triage decision

| Evidence | Action |
| --- | --- |
| No physical-device reproduction | Do not edit input handling; retain existing automated coverage as regression protection only. |
| Reproduces on a served phone | Capture the smallest deterministic route, add a played acceptance assertion around the existing interaction path, then fix the served defect. |
| Only synthetic/emulator input fails | Treat it as harness coverage work, not proof of a tactile regression. |

## Merge boundary

M3-E1 interaction work must not duplicate an in-flight controller or feedback change. A tactile follow-up may begin only with the evidence above and after identifying the affected served interaction path.

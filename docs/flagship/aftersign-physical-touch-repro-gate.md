# AFTERSIGN physical-touch reproduction gate

Scope: this note is the recording standard for **#2071**, the human
device pass. It does **not** gate interaction fixes.

## Why this exists

`docs/flagship/BRIEF.md` (§ "The human device pass (#2071) is no longer a
blocker", line ~349) establishes two things:

1. The **blind AI-stranger playtest at served 390×844** is the default
   human-proxy closeout bar.
2. A **real stranger's answer on a physical phone outranks** the AI one
   whenever it arrives.

Both can be true because they are the same evidence shape at different
strengths. This doc only defines what a #2071 recording must contain so
that, when a device run does arrive, it is strong enough to outrank the
AI-stranger default on the record.

## What is **not** a precondition

- A physical-device run is **not required** before fixing a served
  interaction bug. A 390×844 Playwright reproduction on the deployed
  page is first-class evidence (see #2193 → #2184: a real tap-layout
  regression fixed from AI-stranger evidence alone, no device needed).
- "Emulator-only" is not a disqualifier. If a failure reproduces on
  served 390×844 against the deployed revision, that is a real bug and
  the owner fixes it under the normal played-coverage rule.
- Automated harness coverage that only fails under synthetic
  `PointerEvent` dispatch — with no served 390×844 reproduction behind
  it — is harness work, not a tactile regression. That is the only
  thing this gate rejects.

## Required evidence for a #2071 device pass

When a human operator runs #2071 on real hardware, the recording in
`docs/flagship/devlog.md` must capture:

- Device model, operating-system version, and browser version.
- Served URL / deployed revision identifier and local time of the run.
- Exact player path from a fresh load to each tested interaction
  (tap-to-talk, drag-look, visible UI buttons — the #2071 scope).
- One expected result and one observed result per interaction.
- A screen recording or timestamped screenshots showing the touched
  control and the resulting state.
- Whether any failure repeats after a full reload.

A pass meeting this bar outranks the AI-stranger closeout on the same
beat. A fail at this bar is filed as a focused bug with the recorded
reproduction, and coordinated with Ivy before touching the shared
player/input controller.

## Triage decision

| Evidence shape | Action |
| --- | --- |
| Served 390×844 reproduction on the deployed page (AI-stranger or scripted) | **First-class.** Owner adds a played assertion on the existing interaction path and fixes the served defect. No device run required. |
| Physical-phone reproduction with the recording above | **Outranks** the AI-stranger result on the same beat (BRIEF). Fix proceeds; devlog records the device pass. |
| Only synthetic/emulator `PointerEvent` dispatch fails, with **no** served 390×844 reproduction | Harness-coverage work. File under the automation lane; do **not** edit input handling on this evidence alone. |

## Merge boundary

Two players in the M3-E1 lane share surface — the player/input
controller and tactile feedback. Any tactile follow-up must identify
the affected served interaction path first, and coordinate with the
in-flight controller/feedback work (see `docs/plan/product-plan.md`
§ M3-E1) to avoid duplicate edits.

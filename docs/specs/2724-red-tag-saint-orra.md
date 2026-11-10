# Spec — #2724 Red tag continuity at Saint Orra

**Delivery issue:** #2741 · **Story:** #2724 · **Epic:** #2579 · **Research:** [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)

## Status

The core of #2724 is **already shipped on main**. This spec records what exists, so later work reuses it instead of adding a second copy. Then it names the one gap that is left.

## What main already does

- **First tap is saved.** The player's first tap between "Take the second packet" and "Ask what changed" writes `state.player.redTagFirstTap` once (`aftersign/main.js:4462-4463`). The stored values are `"take-second-packet" | "ask-what-changed"`. The field starts as `null` (`main.js:5576`). It is restored from the slot, and only those two values are accepted on load (`main.js:1230-1233`).
- **Carry control exists.** The Episode 1 ending renders `#carryRedTagToSaintOrra`, labelled "Carry the red tag to Saint Orra", with `data-choice-id="carry-red-tag-to-saint-orra"` (`main.js:2563-2572`).
- **Orra recall exists.** Once the tag is delivered, `#saintOrraRedTagRecall` shows the line from `saintOrraRecallLine()` (`main.js:2511-2520`, `2542-2555`):
  - `take-second-packet` → "You took the red tag at once. I remember the hand that did not wait."
  - `ask-what-changed` → "You asked what changed before you carried it. I remember the question."
  - anything else (including `null`) → "You brought the red tag to my door. I remember the courier."
- **Already tested.** Per the PR #2745 review, `aftersign/e2e/episode-one-ending-served.spec.ts:322-364` and `aftersign/e2e/m4-act-two.playtest.spec.ts:118-153` assert both recall lines, the carry control, a reload in a fresh context and a visible reset path.

## Decisions

- **Reuse, don't add.** No new field, enum, control or copy. `state.player.redTagFirstTap` and its two shipped values are the only source of truth. No ending flag, packet id, delivery id or job-offer copy may stand in for it.
- **Reuse the existing specs.** Any new assertion goes into `aftersign/e2e/episode-one-ending-served.spec.ts`, next to the existing red-tag cases. Do not create a parallel `red-tag-saint-orra.spec.ts`.
- **Neutral fallback is the remaining gap.** The `null` branch of `saintOrraRecallLine()` exists in code. The review evidence above covers the two tapped branches only. So this spec asks for a check on the neutral line alone.

## Acceptance criteria

Each AC is reached by taps on the served page at a 390×844 viewport. No test sets `state` directly.

- AC-1: (shipped) WHEN the player reaches the Episode 1 ending, THE game SHALL show the "Carry the red tag to Saint Orra" control.
- AC-2: (shipped) WHEN the player first taps "Take the second packet" and then carries the tag, THE game SHALL show "You took the red tag at once. I remember the hand that did not wait."
- AC-3: (shipped) WHEN the player first taps "Ask what changed" and then carries the tag, THE game SHALL show "You asked what changed before you carried it. I remember the question."
- AC-4: (shipped) WHEN the player reloads the slot after the first tap, THE game SHALL still show the recall line for that tap.
- AC-5: (gap) IF `redTagFirstTap` is `null` when the tag reaches Saint Orra, THEN THE recall SHALL read "You brought the red tag to my door. I remember the courier." AND SHALL NOT contain "at once" or "asked what changed".

## Out of scope

- Any new red-tag field, control, copy or take/decline choice.
- Changing the "Take the second packet" / "Ask what changed" labels or the job-offer copy.
- Maud Underbell, the Bell Archive, and later Act II encounters.

## References

- Research: [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)
- Design: [docs/design/2724-red-tag-saint-orra.md](../design/2724-red-tag-saint-orra.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)

## Constitution check

- C1: pass — the recall names only the player's real first tap.
- C2: pass — every AC is reached by visible taps at 390×844.
- C3: pass — AC-1 to AC-4 are labelled as shipped and are not claimed as new. Only AC-5 asks for new coverage.
- C4: pass — one line per stored value.
- C5: pass — AC-5 stops the neutral path from claiming a tap that never happened.
- C6: pass — the ACs use EARS.
- C7: pass — the field is saved with the slot, and the existing specs cover the reload.
- C8: pass — existing tests cover both taps and the reload. AC-5 covers the fallback.

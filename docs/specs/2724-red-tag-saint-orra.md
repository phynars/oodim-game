# Spec — #2724 Red tag continuity at Saint Orra

**Delivery issue:** #2741 · **Story:** #2724 · **Epic:** #2579 · **Research:** [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)

## Problem

Episode 1 has no take/decline choice for the red tag. The shipped job offer ("Take the red-tag job" in `apps/web/src/aftersign/aftersignJobOfferCopy.js`) is picked from packet-outcome memory. It is not a choice the player makes. What the player does choose is their **first tap** when the second packet is offered: either "Take the second packet" or "Ask what changed". Saint Orra has to recall that real first tap. She must never invent one.

## Decisions (answers to the research's open questions)

- **Authoritative control:** the player's first tap between "Take the second packet" and "Ask what changed". That tap is the only source of truth. No other ending flag, packet id, or delivery id may stand in for it.
- **Persisted field:** `state.memory.redTagFirstTap`, with the values `"took-at-once" | "asked-first" | null`. This story adds the field. The first tap writes it once, it is saved with the slot, and it survives a reload.
- **Fallback:** if `redTagFirstTap` is `null` because the player never tapped either control, Orra and Io use a neutral line. That line claims neither "took it at once" nor "asked first".
- **New visible control:** the Episode 1 ending gets one new button that carries the red tag on to Saint Orra. The existing first-tap labels and the job-offer copy stay as they are.

## Acceptance criteria

All ACs are driven by taps on the served page at a 390×844 viewport. No test may set `state` directly.

- AC-1: WHEN the player taps through the Episode 1 ending on the served page at 390×844, THE game SHALL show a visible control that carries the red tag to Saint Orra.
- AC-2: WHEN the player taps "Take the second packet" first and then reaches Saint Orra, THE game SHALL show an Orra line saying the player took the red tag at once.
- AC-3: WHEN the player taps "Ask what changed" first and then reaches Saint Orra, THE game SHALL show an Orra line saying the player asked first.
- AC-4: IF the player never tapped "Take the second packet", THEN THE Orra and Io lines SHALL NOT say the red tag was taken at once.
- AC-5: WHEN the player reloads the slot after the first tap and before reaching Saint Orra, THE game SHALL still show the Orra line that matches the recorded first tap.

## Out of scope

- Adding any take/decline or refuse control for the red tag.
- Changing the existing "Take the second packet" / "Ask what changed" labels or the job-offer copy.
- Later Act II encounters, including Maud Underbell and the Bell Archive.
- Unrelated ending, seal, or vigil memory.

## References

- Research: [docs/research/2724-red-tag-saint-orra.md](../research/2724-red-tag-saint-orra.md)
- Architecture: [docs/plan/architecture/README.md](../plan/architecture/README.md)

## Constitution check

- C1: pass — the recalled outcome names the player's real first tap.
- C2: pass — every AC is a visible tap on the served page at 390×844. None is reached through the harness or by setting state.
- C3: pass — each AC asserts a new Orra line or a new control that is absent on main (see the design's test map).
- C4: pass — each recall is one line tied to one tap.
- C5: pass — AC-4 and the `null` fallback stop Orra or Io from claiming a tap that never happened.
- C6: pass — the ACs use EARS and the spec is indexed.
- C7: pass — `redTagFirstTap` is saved with the slot. AC-5 covers the reload.
- C8: pass — tests cover both first taps, the never-tapped fallback, and the reload.

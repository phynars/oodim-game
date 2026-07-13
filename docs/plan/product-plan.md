# AFTERSIGN — product plan

**Owner of this doc:** spec-writer (Charlie). Updated per planning cycle.
**Sources of truth:** `docs/flagship/BRIEF.md`, `docs/flagship/concept.md`,
`docs/flagship/io-first-memory-beat-plan.md`, `docs/flagship/story-state-contract.md`.

This is the single top-level plan. Its job is to make merged PRs add up to a
**shippable outcome**. Exactly ONE milestone is active at a time; stories are
filed only for the active epic. A milestone is a thing a person can PLAY and
say yes/no about — never an internal artifact ("harness exists").

---

## Vision

AFTERSIGN proves the flagship's soul in the smallest honest frame: a player
does something, leaves, returns, and an NPC (Io) says something that could
*only* be true because of what the player did before. Memory read as social
contact — not a save file, a recognition. When that one beat lands on a phone
in under two minutes, the flagship has a heartbeat we can build a city around.

---

## Milestones

### M1 (ACTIVE) — Io remembers your blue-packet choice across a real session boundary

**Observable outcome:** A visitor on a phone opens the AFTERSIGN slice, makes
the blue-packet choice (keep sealed vs. open), closes/reloads the page, and on
return Io speaks a line that fits *their* choice and only their choice. A second
visitor who chose the opposite hears a visibly different line.

**Definition of done (falsifiable):**
- Load `game.oodim.com/aftersign` on a phone; make a choice; hard-reload.
- Io's returning line matches the choice made — and differs from the other
  outcome's line.
- The `test:e2e:aftersign` CI lane proves this for BOTH outcomes and turns RED
  under the three documented break modes.

**LoE budget:** ~1 epic (E1). Later epics (a second beat, a second NPC) are
explicitly OUT of M1 — they are M2+.

### M2 (planned, not active) — A second aftersign beat chains off the first
_Deferred. Do not file stories until M1's E1 integration story passes._

---

## Active milestone (M1) — epics

### E1 (ACTIVE) — Io first-memory beat survives save→reload and speaks the outcome-correct line

**Acceptance criteria:** The signature promise is machine-verified end to end —
choose → save → reload → Io says the outcome-correct, outcome-DISTINCT line, and
`wrong-io-line` / `drop-memory` / `local-only-save` break modes fail the lane.

**Status:** in progress. Precursor harness merged; integration proof (#653) open.

**Integration story (the done-gate):** **#653** — `save→reload→correct Io line
for BOTH outcomes, with red break-mode guards`. E1 is DONE when #653 is green,
not when its pieces merge. Everything below either feeds #653 or hardens it.

---

## Story map (E1)

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Integration proof (done-gate)** — both outcomes, correct distinct Io line, 3 red break modes | **#653** | M | integration | open |
| Update aftersign e2e specs to `FlagshipSceneBeat` names + field-based assertions | #601 | L | precursor (unblocks stable beat naming for #653) | open (blocked-by #600) |
| Wire Io phone-ready look/sound contract into executed e2e lane | #544 | M | hardening (phone-viewport feel guard on the beat #653 proves) | open |
| Precursor reload-beat regression harness (single sealed path) | — (`aftersign/e2e/flagship-reload-beat-regression.spec.ts`) | — | merged precursor — #653 generalizes it to both outcomes + break modes | merged |

**Integration-first note:** #653 is filed and mapped BEFORE further
implementation stories because it defines what "E1 done" means. #601 and #544
are supporting — they make the beat namable and phone-ready — but neither on its
own proves the epic outcome. If forced to sequence: land #653's both-outcome +
break-mode assertions against the live shape; #601's rename can follow (#566
phase-3) without blocking the outcome.

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M1 work:

- **#615** — does not map to M1-E1; revisit under M2 or reclassify.
- **#622** — does not map to M1-E1; revisit under M2 or reclassify.
- **#454** — does not map to M1-E1; likely pre-flagship debt; reclassify or close.
- **#634** — does not map to M1-E1; revisit under M2 or reclassify.

_Disposition owed: confirm each is M2-fodder vs. stale debt. Until then they are
outside the plan and the backlog picker should not treat them as M1 stories._

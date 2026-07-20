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

### M1 (DONE ✅) — Io remembers your blue-packet choice across a real session boundary

**Observable outcome:** A visitor on a phone opens the AFTERSIGN slice, makes
the blue-packet choice (keep sealed vs. open), closes/reloads the page, and on
return Io speaks a line that fits *their* choice and only their choice. A second
visitor who chose the opposite hears a visibly different line.

**Shipped:** E1's integration proof **#653 merged 2026-07-15**. The both-outcome
save→reload→correct-Io-line assertions plus the three red break modes
(`wrong-io-line` / `drop-memory` / `local-only-save`) live in
`aftersign/e2e/flagship-surface-contract.spec.ts`. The signature promise is now
machine-guarded on every push. M1 is falsified-negative-proof and closed.

### M2 (ACTIVE) — A second aftersign beat chains off the first

**Observable outcome:** A returning visitor whom Io *already* recognized (from
the M1 packet beat) does a NEW deliberate action in the same slice, leaves, and
returns AGAIN. On that second return Io speaks a line that references BOTH
memories at once — the original packet choice AND the new action — so the player
feels a relationship accumulating, not two independent recognitions. A visitor
who skipped the second action hears a line that acknowledges only the first
memory (the `bareReturn`-family fallback), visibly distinct from the chained
line.

**Definition of done (falsifiable):**
- On a phone: complete the packet beat, reload (M1 recognition fires), do the
  second action, reload again → Io's line references the packet outcome AND the
  second action in one authored sentence.
- A control player who does packet-only-then-reload-twice hears the
  single-memory line, NOT the chained line.
- The e2e lane proves the chained vs. single-memory branch for the packet
  outcomes AND turns RED when the second memory is dropped or the wrong
  (single-memory) line is served to a two-memory player.

**LoE budget:** ~1 epic (E1). A second NPC, branching episodes, and a
memory *graph* remain OUT — they are M3+.

---

## Active milestone (M2) — epics

### E1 (ACTIVE) — A second memory chains onto Io's first recognition in one line

**Acceptance criteria:** The slice persists a SECOND player action alongside the
M1 packet outcome, and on the next return Io serves ONE authored line that
references both memories for a two-memory player — while a one-memory (packet
only) player still gets the single-memory line. Wrong-branch and dropped-second-
memory paths fail the e2e lane.

**Status:** active. Copy surface pattern exists (`bareReturn` extension via
#731); no chained-beat integration proof yet.

**Integration story (the done-gate):** **#735** (filed this session) —
`two-memory return serves the chained line for both packet outcomes; one-memory
return serves the single-memory line; red break modes for dropped-second-memory
and wrong-branch`. E1 is DONE when #735 is green, not when its pieces merge.
Everything below either feeds #735 or hardens it.

**Integration story of M1 (reference):** #653 (merged) proved the *single*
memory beat. M2-E1's #735 is the strict generalization: prove that a SECOND
memory chains, without regressing the first.

---

## Story map (M2-E1)

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Integration proof (done-gate)** — two-memory chained line + one-memory fallback, both packet outcomes, red break modes | **#735** | M | integration | filed this session |
| Extend Io returning copy in the package with a `bareReturn`/empty-memory key (single-source, parity-guarded) | **#731** | S | building block — establishes the fallback/single-memory line surface #735 asserts against | open |
| Persist the second player action alongside packet outcome; expose it on `window.__game.story.memoryBeat` | **#736** | M | building block — the second durable memory #735 chains on | filed this session |
| Author + wire the two-memory CHAINED line in the package; parity re-export | **#737** | S | building block — the line #735 proves is served for two-memory players | filed this session |
| Wire Io phone-ready look/sound contract into executed e2e lane | #544 | M | hardening — carries over from M1; phone-viewport feel guard on the chained beat | open |

**Integration-first note:** #735 is filed and mapped BEFORE the implementation
stories because it defines what "M2-E1 done" means. #731/#736/#737 are the three
building blocks (fallback line / second memory / chained line); none alone
proves the epic outcome. Sequence if forced: #736 (second memory persists) →
#731 + #737 (both lines authored) → #735 asserts the branch end to end.

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M2 work:

- **#727** — [Mara, `agent-needs-human`] AFTERSIGN red/green workflow relies on
  brittle spec marker text for retirement gating. Real harness debt, but it is a
  *process/tooling* fix, not part of the M2-E1 chained-beat outcome. Human-flagged;
  disposition owed by operator. Does NOT enter the M2 story map.

_Prior-cycle drift (#615/#622/#454/#634) is now CLOSED — no longer open, removed
from this list. The only current drift is #727 above._

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

### M2 (DONE ✅) — A second aftersign beat chains off the first

**Observable outcome:** A returning visitor whom Io *already* recognized (from
the M1 packet beat) does a NEW deliberate action in the same slice, leaves, and
returns AGAIN. On that second return Io speaks a line that references BOTH
memories at once — the original packet choice AND the new action — so the player
feels a relationship accumulating, not two independent recognitions. A visitor
who skipped the second action hears a line that acknowledges only the first
memory (the `bareReturn`-family fallback), visibly distinct from the chained
line.

**Shipped:** E1's integration proof **#735 merged + closed 2026-07-21**. The
two-memory chained line vs. one-memory fallback is asserted for BOTH packet
outcomes in `aftersign/e2e/flagship-surface-contract.spec.ts`, with the two red
break modes (dropped-second-memory → chained line unreachable; single-memory
line served to a two-memory player) live on every push. Building blocks
#736 (second-memory persistence), #731 (fallback line), #737 (chained line)
all merged + closed. The "relationship accumulates" promise is now
machine-guarded. M2 is falsified-negative-proof and closed.

---

## Milestones (cont.)

### M3 (ACTIVE) — A SECOND character remembers you, independently of Io

**Observable outcome:** A returning visitor who already has a relationship with
Io meets a DIFFERENT named character in the same slice — Saint Orra, the living
sign over the old pharmacy — performs one deliberate action toward Orra (touch
the sign gently vs. strike it to make it speak), leaves, and returns. On return
Orra speaks a line that references *that* prior action — proving the memory
mechanic is not welded to one NPC but is a property of the world. Io's own
recognition is UNTOUCHED: the same returning player still hears Io's correct
chained line. A player who never touched Orra hears Orra's first-contact line,
visibly distinct from the recognition line.

**Why this is the next-smallest outcome:** M1 proved one memory; M2 proved two
memories on ONE NPC. The concept's Act II turns on a SECOND remembering
character (Saint Orra) with her OWN memory of the player. M3 proves the
mechanic generalizes to a second independent memory-holder — the smallest honest
step toward "a world whose people know your name" — WITHOUT yet introducing a
memory graph, cross-NPC memory sharing, or branching episodes (all M4+).

**Definition of done (falsifiable):**
- On a phone: complete the Io beats (M1+M2), meet Saint Orra, perform the Orra
  action (gentle-touch OR strike), reload → Orra speaks a line that references
  that specific action.
- The SAME returning player still hears Io's correct chained line — Orra's
  memory does not regress or contaminate Io's.
- A control player who never interacts with Orra hears Orra's first-contact
  line, NOT a recognition line.
- The e2e lane proves the gentle-vs-strike branch for Orra AND the Io-parallel
  recognition, and turns RED when: Orra's memory is dropped, the wrong Orra
  line is served, OR the presence of Orra's memory perturbs Io's line.

**LoE budget:** ~1 epic (E1: prove the second independent NPC memory end to
end). A memory *graph*, cross-NPC memory (Orra referencing an Io beat), Niko /
Maud / the Child, and branching episodes remain OUT — they are M4+.

---

## Active milestone (M3) — epics

### E1 (ACTIVE) — Saint Orra remembers a player action independently of Io

**Acceptance criteria:** The slice persists a SECOND, per-NPC memory record for
Saint Orra (the gentle-touch vs. strike action) keyed to the durable player id,
alongside — and independent of — the existing Io memory beat. On the next return
Orra serves the correct recognition line for a player who acted, the
first-contact line for a player who did not, and Io's own chained line is
unchanged. Dropped-Orra-memory, wrong-Orra-line, and Io-contamination paths all
fail the e2e lane.

**Status:** active. No Orra runtime surface, memory record, or lines exist yet
(concept-only); Io's memory surface (`window.__game.story.memoryBeat`) is the
proven pattern the Orra record parallels.

**Integration story (the done-gate):** **#863** — proves Orra's independent
recognition (action vs. first-contact branch across reload) + Io non-regression
+ the three red break modes (`orra-dropped` / `orra-wrong` /
`orra-io-contamination`). E1 is DONE when that lane is green, not when its
building blocks merge. Everything below either feeds that proof or hardens it.

**Integration story of M2 (reference):** #735 (merged) proved a second memory on
ONE NPC. M3-E1's integration proof is the orthogonal generalization: a second
memory on a SECOND NPC, proven not to disturb the first NPC's memory.

---

## Story map (M3-E1)

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Integration proof (done-gate)** — Orra action/first-contact split across reload + Io non-regression + `orra-dropped` / `orra-wrong` / `orra-io-contamination` red modes | **#863** | M | integration | filed |
| Persist an Orra-owned memory record (distinct storage key + `kind: "orra-recognition"`); expose on `window.__game.story.orraMemoryBeat`, isolated from Io's | **#865** | M | building block — Orra's durable, Io-isolated memory the proof reads | filed |
| Author + wire Orra's FIRST-CONTACT line + her RECOGNITION line in the copy package (single-source, parity-guarded) | **#864** | S | building block — the two lines the proof asserts (first-contact vs. recognition) | filed |

**Integration-first note:** #863 (the done-gate) is filed and mapped BEFORE the
implementation stories because it defines what "M3-E1 done" means. The two
building blocks (#865 Orra's isolated memory record / #864 Orra's first-contact
+ recognition lines) each feed the proof; neither alone proves the epic outcome.
Sequence if forced: #865 (persist Orra memory record) → #864 (author both Orra
lines) → #863 (integration lane asserts the branch + Io non-regression end to end).

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M3 work:

- **#727** — [Mara, `agent-needs-human`] AFTERSIGN red/green workflow relies on
  brittle spec marker text for retirement gating. Real harness debt, but it is a
  *process/tooling* fix, not part of the M3-E1 Orra-recognition outcome.
  Human-flagged; disposition owed by operator. Does NOT enter the M3 story map.

_Prior-cycle drift (#615/#622/#454/#634) is now CLOSED — no longer open, removed
from this list. The only current drift is #727 above._

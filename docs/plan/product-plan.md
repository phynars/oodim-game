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

### M3 (HARNESS-GREEN, NOT PLAYER-SHIPPED ⚠️) — A SECOND character remembers you, independently of Io

**Reframed 2026-08-01 (Founder DoD amendment).** M3-E1's done-gate #863 is
CLOSED and green — but green in the CONTRACT HARNESS (`orraIndependentRecognition.integration.test.ts`,
jsdom `sampleAftersignOrraMemoryBeat`), NOT on the served page. A `grep` for
`recognitionFeedback|packetIntent|ioReturningSession` consumers in
`apps/web/**/main.js` returns ZERO matches. Under the amended Definition of
Done, Orra's recognition is **stored spec-capital, not shipped value** — a
player at game.oodim.com/aftersign cannot yet see or feel any of it.

M1, M2, and M3 were all declared DONE against contract tests, not the deployed
surface. That is precisely the failure the Founder measured (268 commits, 45
touching the served page, ZERO contract modules imported by it). These
milestones are NOT re-opened, but their "DONE" is downgraded to
**harness-green**: the invariants are guarded; the player experience is not yet
wired. The active milestone is now the one that closes that gap.

---

## Milestones (cont.)

### M-WIRE (ACTIVE) — a first-time phone player at game.oodim.com/aftersign FEELS the recognition beat, and Io remembers them next session

**Observable outcome (falsifiable on the DEPLOYED page):** A stranger opens
game.oodim.com/aftersign on a phone with no prior state. They are offered the
packet; a **tap preserves the seal**, a **~420ms hold opens it** (with
cancel/inspect), and they FEEL the recognition beat — the camera push, the sign
glow, the feel envelope the July `recognitionFeedback` contract already asserts.
They close the page. On a LATER session they return and Io speaks a line that
remembers their packet outcome (`ioReturningSession` + the `IO_BARE_RETURN`
family). Every one of those beats is served by wired page code — not a jsdom
test — and the epic's e2e drives the deployed surface end to end.

**Why this is the next-smallest outcome (and why it is not M4):** M1–M3 proved
the memory mechanic in the harness. Before a SECOND-character world (M4) or new
content earns a milestone, the contract library the studio spent July building
must have a CONSUMER on the page. Per the BRIEF amendment, a contract with no
consumer is not shippable value, and wiring an existing contract INTO the page
"counts double." This milestone converts the stored capital (Io recognition,
packet-intent feel, Orra recognition) into something a player can experience.
NO new mechanic, NO new character content, NO episode structure — those are M4+.

**Definition of done (falsifiable, served-page):**
- On a phone at game.oodim.com/aftersign: offer → tap-preserve / 420ms-hold-open
  (with cancel/inspect) → deliver → the recognition beat is FELT (camera push /
  sign glow / feel envelope from `recognitionFeedback`).
- Close + return in a later session → Io serves the returning-session line that
  matches the player's packet outcome (wired `ioReturningSession`).
- The epic's integration e2e DRIVES THE DEPLOYED PAGE (not a pure module) and
  asserts the wired offer→feel→return chain; it turns RED if any beat regresses
  to unwired.
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface (harness-only rationed to 1-in-4 per the amendment).

**LoE budget:** ~1 epic (the #954 M2-EINT wiring epic, re-homed here as the
active milestone). Orra's served wiring, a memory graph, cross-NPC memory, and
new episodes remain OUT — M4+.

---

### M4 (DEFERRED) — A SECOND character remembers you on the served page (Orra, wired)

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

## Active milestone (M-WIRE) — epics

### EINT (ACTIVE) — every July contract module gains a consumer on the served page (#954)

**Acceptance criteria:** `aftersign/main.js` (the served entry) imports and
consumes the July contract library — `recognitionFeedback`, the `packetIntent`
feel model, and the `ioReturningSession` / `IO_BARE_RETURN_LINE` returning-session
lines — so each beat those modules assert is present on the deployed surface.
A single integration e2e drives `game.oodim.com/aftersign` end to end (offer →
tap-preserve / 420ms-hold-open → deliver → reload → return-next-session) and
asserts each wired beat is FELT on the served page. The epic is DONE when that
served-page lane is green — not when the individual wiring PRs merge.

**Status:** active. `ioReturningSession` is now PARTIALLY wired — `main.js:38`
imports `chooseIoReturningSessionLine` and consumes it at lines 1655-1669
(landed in #980/#985), so the returning-session line is on the surface for the
sealed/opened outcomes; the remaining bindings (`recognitionFeedback` feel
envelope, `packetIntent` offer/commit) are NOT yet imported by the served
entry (#954 founder measurement stands for those two). Contract modules are
green in isolation. Per #954's CONSUMER RULE, this epic is a pure consumer
epic — the high-value work is wiring, not new harness (harness-only additions
need explicit justification).

**Integration story (the done-gate):** **#1004** — one e2e that drives the SERVED
page through offer → tap-preserve / hold-open → deliver → reload →
return-next-session and asserts the wired beats. Written FIRST, lands LAST.
EINT is DONE when this lane is green against the deployed surface.

**Integration story of M2 (reference):** #735 (merged) proved chained memory in
a MODULE lane. M-WIRE's integration proof is the orthogonal generalization: the
same beats, but driven through the DEPLOYED page — closing the module-vs-surface
gap that #954 measured and #863 exposed (M3 harness-green, player-unshipped).

---

## Story map (M-WIRE-EINT)

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Integration proof (done-gate)** — one e2e drives the SERVED page offer → preserve/open → deliver → reload → return-next-session, asserts each wired beat | **#1004** | M | integration | filed |
| Wire `recognitionFeedback` (aftersign/src/recognitionFeedback.ts) into main.js — player FEELS the recognition beat (camera push, sign glow) on deliver | **#1003** | M | consumer — the feel envelope the proof asserts on the surface | filed |
| Wire the `packetIntent` feel model into the page — tap preserves the seal, 420ms hold opens, with cancel/inspect | **#956** | M | consumer — the offer/commit interaction the proof drives | filed |
| Wire Io returning-session lines (`ioReturningSession` + `IO_BARE_RETURN_LINE`) into the served scene — a later-session return hears Io remember the packet outcome | **#1002** | M | consumer — the returning-session line the proof asserts | **partially landed** (#980/#985 — main.js:38, 1655-1669) |

**Integration-first note:** #1004 (the done-gate) is filed and mapped BEFORE the
consumer stories because it defines what "M-WIRE-EINT done" means — a green lane
against the SERVED page. The three consumer stories (#1003 recognition feel /
#956 packet-intent / #1002 returning-session lines) each give one July module a
consumer in `main.js`; none alone closes the module-vs-surface gap. Sequence if
forced: #956 (offer/commit, the entry interaction) → #1003 (recognition feel on
deliver) → #1002 (returning-session line on reload — already partly landed) →
#1004 (integration lane asserts the full arc against the deployed surface).

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M-WIRE work:

- **#976 / #977 / #978** — [Mara, `type:refactor`, decomposed from #974] add
  explicit `.ts` extensions / migrate check bundles to a plain-Node runner in
  the aftersign subgraph. Genuine harness/tooling debt, but pure internal
  refactor — no player sees or feels it, so it does NOT serve M-WIRE-EINT's
  served-page outcome. Operator disposes; does NOT enter the story map.
- **#727** — [Mara, `agent-needs-human`] AFTERSIGN red/green workflow relies on
  brittle spec marker text for retirement gating. Process/tooling fix, not part
  of the M-WIRE served-page outcome. Human-flagged; disposition owed by operator.

_M3 (Saint Orra) is DEFERRED to M4, not drift: its harness-green integration
(#863) shipped in the contract lane but not on the served page, so its
served-page wiring is deliberately gated behind M-WIRE-EINT closing the
module-vs-surface gap first. Prior-cycle drift (#615/#622/#454/#634) resolved.
Current drift is #976/#977/#978 + #727 above._

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

### M3 (SUPERSEDED — harness twin of the now-ACTIVE M-ORRA) — A SECOND character remembers you, independently of Io

**Reframed 2026-08-01 (Founder DoD amendment), promoted 2026-08-14.** M3-E1's
done-gate #863 is CLOSED and green — but green in the CONTRACT HARNESS
(jsdom `sampleAftersignOrraMemoryBeat`), NOT on the served page. Under the amended
Definition of Done, Orra's recognition was **stored spec-capital, not shipped
value**. M-WIRE closed the module-vs-surface gap FOR IO; the Orra half of that gap
is now the active milestone **M-ORRA** below. M3 is not re-opened and not drift —
it is the harness twin whose served-page wiring M-ORRA-E1 delivers.

---

## Milestones (cont.)

### M-WIRE (DONE ✅) — a first-time phone player at game.oodim.com/aftersign FEELS the recognition beat, and Io remembers them next session

**Shipped 2026-08-11.** All three July contract consumers landed on the served
entry `aftersign/main.js` (verified @ 60b9db25): `packetIntent` (tap-preserve /
420ms-hold-open gesture at `main.js:146,847-870`), `recognitionFeedback` (measured
feel envelope on deliver, `main.js:31` bridge → 252-259), and `ioReturningSession`
(returning-session line, `main.js:41`). The EINT done-gate — the served-page e2e
in `flagship-surface-contract.spec.ts` — went RED on main (#1113) post-merge and
was **repaired + closed 2026-08-11**. The lane now drives
`game.oodim.com/aftersign` offer → tap-preserve/hold-open → deliver → reload →
return-next-session and is GREEN on main. The founder's zero-consumer measurement
is cleared: the July contract library is player-shipped, not stored capital.
Prior red-main repairs #1093 / #1100 and consumer stories #956 / #1002 / #980 /
#985 all merged + closed. M-WIRE is falsified-negative-proof and closed.

---

### M-ORRA (ACTIVE) — a returning phone player meets a SECOND named character (Saint Orra) who remembers their action, on the served page

**Deadline: 2026-08-22** (founder — the public demo date; see
docs/flagship/BRIEF.md "The deadline"). **8 days remaining as of 2026-08-14.**
Cut scope before slipping this date; sequence stories by TIME REMAINING — a
rough-but-PLAYABLE second-character beat beats a polished-but-partial one.

**Observable outcome (falsifiable on the DEPLOYED page):** A returning phone
player at game.oodim.com/aftersign — one Io already recognizes (M-WIRE) — meets a
DIFFERENT named character in the same slice: **Saint Orra**, the living sign over
the old pharmacy. They perform ONE deliberate action toward Orra (**gentle-touch**
the sign vs. **strike** it to make it speak), leave, and return in a later
session. On return **Orra speaks a line that references THAT action** — proving
the memory mechanic is a property of the WORLD, not welded to Io. Io's own
recognition is UNTOUCHED: the same returning player still hears Io's correct
returning-session line. A control player who never touched Orra hears Orra's
first-contact line, visibly distinct from the recognition line. Every beat is
served by wired page code — the epic's e2e drives the deployed surface end to end.

**Why this is the next-smallest outcome:** M-WIRE proved the July contract
library reaches the PLAYER (Io's recognition felt + remembered on the served
page). M3's Orra recognition already exists as green CONTRACT harness (#863) but
has ZERO consumers in `aftersign/main.js` — stored capital, per the BRIEF
amendment. This milestone converts that specific stored capital into player value
by giving the Orra contract a consumer on the served page. It is the smallest
honest step toward "a world whose people know your name": a SECOND independent
recognizer on the deployed surface. A memory *graph*, cross-NPC memory (Orra
referencing an Io beat), Niko / Maud / the Child, and branching episodes remain
OUT — M5+.

**Definition of done (falsifiable, served-page):**
- On a phone at game.oodim.com/aftersign: complete the Io beats (M-WIRE), meet
  Saint Orra, perform the Orra action (gentle-touch OR strike), reload → **Orra**
  serves a line that references THAT specific action, wired on the served page.
- The SAME returning player still hears Io's correct returning-session line —
  Orra's memory does not regress or contaminate Io's.
- A control player who never interacts with Orra hears Orra's first-contact line,
  NOT a recognition line.
- The epic's integration e2e DRIVES THE DEPLOYED PAGE (not the jsdom harness) and
  turns RED when: Orra's memory is dropped, the wrong Orra line is served, OR the
  presence of Orra's memory perturbs Io's line (the three #863 red modes, now on
  the served surface).
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface (harness-only rationed to 1-in-4 per the amendment; #863 already spent
  the harness — this milestone spends only served-page wiring).

**LoE budget:** ~1 epic (E1: wire Orra's existing recognition contract into the
served page and prove it end to end). A memory graph, cross-NPC memory, new
characters, and branching episodes remain OUT — M5+.

---

## Active milestone (M-ORRA) — epics

### E1 (ACTIVE) — Orra's recognition contract gains a consumer on the served page, proven end to end

**Acceptance criteria:** `aftersign/main.js` (the served entry) imports and
consumes the Orra recognition contract that #863 proved in the harness — the
`kind: "orra-recognition"` parallel record (`AftersignNpcMemoryBeat` shape in
`aftersign/.../npcMemoryRoundTrip.ts`), the gentle-touch-vs-strike action
classifier, and Orra's recognition / first-contact copy keys — so each beat is
present on the DEPLOYED surface. A single integration e2e drives
`game.oodim.com/aftersign` end to end (Io beats → meet Orra → gentle-touch/strike
→ reload → Orra recognition line) and asserts each wired beat is served, PLUS Io
non-regression. The epic is DONE when that served-page lane is green — not when
the individual wiring PRs merge.

**Status:** active — 8 days to deadline (2026-08-22). Orra's contract is
harness-green (#863, closed 2026-07-29) with ZERO consumers in `main.js` at last
audit (M3 reframe, 2026-08-01). This is a WIRING epic: no new contract, no new
harness — spend the entire budget on served-page consumers + the served-page
done-gate. Sequence by time: the served offer → Orra-action → reload → Orra-line
chain must be PLAYABLE by 08-22 even if rough; polish (feel envelope on the
strike, sign-glow parity with Io) is cuttable scope.

**Integration story (the done-gate — filed FIRST):** the epic's served-page e2e
drives Io beats → meet Orra → gentle-touch/strike → reload → Orra recognition
line against the DEPLOYED surface, asserts the action-vs-first-contact split AND
Io non-regression, and turns RED under `orra-dropped` / `orra-wrong` /
`orra-io-contamination` on the SERVED page (the #863 red modes, promoted from
harness to surface). M-ORRA-E1 is DONE when this lane is green on main.

**Reference:** #863 (closed) is the MODULE-lane proof of the same three
assertions in jsdom. M-ORRA-E1's integration proof is the orthogonal
generalization: the same Orra beats, but driven through the DEPLOYED page —
exactly the module-vs-surface gap M-WIRE closed for Io, now closed for Orra.

---

## Story map (M-ORRA-E1)

Filed 2026-08-14; issue numbers land as the stories are created this cycle.

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Served-page Orra e2e (done-gate, filed FIRST)** — drive Io beats → meet Orra → gentle-touch/strike → reload → Orra recognition line on the deployed page; assert action-vs-first-contact split + Io non-regression; RED under the three #863 modes | _this cycle_ | M | integration done-gate | filing |
| Wire the Orra `kind:"orra-recognition"` record round-trip into `main.js` — persist + rehydrate across reload | _this cycle_ | M | consumer (persistence) | filing |
| Wire the gentle-touch-vs-strike action classifier + Orra encounter into the served scene | _this cycle_ | M | consumer (action/offer) | filing |
| Wire Orra's recognition / first-contact copy selection into the served scene, with Io non-regression | _this cycle_ | M | consumer (returning line) | filing |

**Integration-first note:** the done-gate e2e is filed FIRST and defines the
epic's outcome; the three wiring stories are the consumers that turn it green.
The gate DRIVES the deployed page and asserts against the served surface, not the
jsdom harness — an unwired Orra contract turns it RED. #863 is the harness twin
(closed); this map spends only served-page wiring, so the harness ration (1-in-4)
is untouched.

---

## Drift — open issues serving NO active epic

The open `agent-filed` backlog is EMPTY as of 2026-08-14 (every M-WIRE story —
consumers + the #1113 done-gate repair — merged/closed), and `list_issues`
returns NO open issues at all. So no open issue currently serves no epic —
there is nothing to dispose this cycle.

The M-WIRE-cycle drift set (#1089 perf-preflight, #1071 gate-marker tooling,
#1065 CI-log ergonomics, #1053 README, #1051 architecture-README, #1081 e2e
input-latency) no longer appears in the open backlog — disposed since the last
cycle.

**#1165**, flagged by the previous planning chunk as likely drift, is NOT present
in the current open backlog (no open issues at all) — already closed or never
filed; nothing to dispose. If it resurfaces, evaluate against M-ORRA-E1's
served-page acceptance: a test-infra or docs item is drift; an Orra served-page
consumer is in-epic.

_Prior-cycle drift resolved: #976/#977/#978/#727 (M-WIRE cycle);
#615/#622/#454/#634 (earlier). M3/#863 is NOT drift — it is the harness twin of
the now-ACTIVE M-ORRA-E1, promoted from deferred to active because M-WIRE closed
the module-vs-surface gap it was gated behind._

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
done-gate #863 is CLOSED and green in the CONTRACT HARNESS (jsdom
`sampleAftersignOrraMemoryBeat` / `meetOrraForAftersignSlice`), which is not the
served page. A separate served Orra recognition lane already exists on
`aftersign/main.js` via `orraRuntimeLane.ts` (landed 2026-07-28) — so Orra is
NOT unwired end-to-end; a player who picks `light-vigil` and returns hears Orra
remember them today. What's still stored-capital is the specific #863 harness
contract surface and its three red modes (`orra-dropped`, `orra-wrong`,
`orra-io-contamination`), which are only asserted in jsdom. The active
milestone **M-ORRA** below promotes those three red modes onto the served-page
e2e over the existing lane. M3 is not re-opened and not drift — it is the
harness twin whose served-page hardening + proof M-ORRA-E1 delivers.

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
the old pharmacy. They perform ONE deliberate action toward Orra
(**light-vigil** → `lit` vs. **spare-vigil** → `spared`, per
`aftersign/src/orraRuntimeLane.ts`'s `ORRA_CHOICE_TO_ACTION`), leave, and return
in a later session. On return **Orra speaks a line that references THAT action**
(`orra_return_lit_vigil` / `orra_return_spared_vigil`) — proving the memory
mechanic is a property of the WORLD, not welded to Io. Io's own recognition is
UNTOUCHED: the same returning player still hears Io's correct returning-session
line. A control player who never touched Orra hears Orra's first-contact line,
visibly distinct from the recognition line. Every beat is served by wired page
code — the epic's e2e drives the deployed surface end to end.

**Why this is the next-smallest outcome:** M-WIRE proved the July contract
library reaches the PLAYER (Io's recognition felt + remembered on the served
page). Orra's served page ALREADY HAS a live recognition lane — `main.js`
imports `actionForOrraChoice` / `buildOrraRecognitionMemoryFact` /
`selectOrraRecognitionLine` from `orraRuntimeLane.ts` and consumes them at
`main.js:23-28, 147, 1102-1129, 1303, 2111` (landed 2026-07-28). A player who
chooses `light-vigil` and returns DOES hear Orra remember them today. What's
STILL stored-capital is the #863 harness contract surface
(`meetOrraForAftersignSlice`, `sampleAftersignOrraMemoryBeat`,
`orraIndependentRecognition.integration.test.ts`) — genuinely unimported by
`main.js`, and asserting the three red modes (`orra-dropped`, `orra-wrong`,
`orra-io-contamination`) only in jsdom. This milestone therefore does NOT wire
Orra from scratch. It (a) HARDENS the existing `orraRuntimeLane` on the served
page against those three failure modes, (b) proves them with a served-page e2e
(not the jsdom harness), and (c) reconciles vocabulary — the served lane speaks
`lit`/`spared`; the #863 harness uses the parallel `kind: "orra-recognition"`
record shape. It is the smallest honest step toward "a world whose people know
your name": a SECOND independent recognizer proven ON the deployed surface. A
memory *graph*, cross-NPC memory (Orra referencing an Io beat), Niko / Maud /
the Child, and branching episodes remain OUT — M5+.

**Reconciliation with `orraRuntimeLane` (explicit):** M-ORRA-E1 keeps and extends
`orraRuntimeLane.ts` — it is NOT replaced. Any bridge to the #863 harness shape
is additive (persistence adapter / test-only sampler), so the served-page
vocabulary of record stays `lit` / `spared`. If a future story finds the two
shapes genuinely incompatible, the tie-breaker is: served lane wins, harness
adapts.

**Definition of done (falsifiable, served-page):**
- On a phone at game.oodim.com/aftersign: complete the Io beats (M-WIRE), meet
  Saint Orra, perform the Orra action (`light-vigil` → `lit` OR `spare-vigil`
  → `spared`, per `ORRA_CHOICE_TO_ACTION`), reload → **Orra** serves the
  matching return line (`orra_return_lit_vigil` / `orra_return_spared_vigil`)
  on the served page. The existing `orraRuntimeLane.ts` selectors are the
  consumer, hardened; no new parallel lane is introduced.
- The SAME returning player still hears Io's correct returning-session line —
  Orra's memory does not regress or contaminate Io's.
- A control player who never interacts with Orra hears Orra's first-contact line
  (`ORRA_FIRST_CONTACT_LINE_ID`), NOT a recognition line.
- The epic's integration e2e DRIVES THE DEPLOYED PAGE (not the jsdom harness) and
  turns RED under the three #863 red modes, now asserted on the served surface:
  `orra-dropped` (recognition lost across reload), `orra-wrong` (return line
  doesn't match `lit`/`spared`), `orra-io-contamination` (Orra memory perturbs
  Io's returning-session line).
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface (harness-only rationed to 1-in-4 per the amendment; #863 already spent
  the harness — this milestone spends only served-page hardening + e2e).

**LoE budget:** ~1 epic (E1: wire Orra's existing recognition contract into the
served page and prove it end to end). A memory graph, cross-NPC memory, new
characters, and branching episodes remain OUT — M5+.

---

## Active milestone (M-ORRA) — epics

### E1 (ACTIVE) — the existing served Orra recognition lane is hardened against the three #863 red modes, on the deployed page, and proven end to end

**Acceptance criteria:** the served entry `aftersign/main.js` already consumes
Orra's recognition via `orraRuntimeLane.ts` (`actionForOrraChoice`,
`buildOrraRecognitionMemoryFact`, `selectOrraRecognitionLine`, plus the
`ORRA_LINE_COPY_BY_ID` copy map) — see `main.js:23-28, 147, 1102-1129, 1303,
2111`. E1 is NOT a from-scratch wiring epic. It:
1. Hardens that lane so a served-page e2e can turn RED under the three #863 red
   modes (`orra-dropped`, `orra-wrong`, `orra-io-contamination`), tightening
   whatever storage / selection paths are fragile today.
2. Adds ONE integration e2e that drives `game.oodim.com/aftersign` end to end
   (Io beats → meet Orra → `light-vigil` or `spare-vigil` → reload → Orra
   return line) and asserts each served beat + Io non-regression.
3. Reconciles the harness surface (`meetOrraForAftersignSlice` /
   `sampleAftersignOrraMemoryBeat` / the `kind: "orra-recognition"` record
   under `apps/web/src/aftersign/`) with the served lane's `lit`/`spared`
   vocabulary — via an additive adapter or test-only sampler if needed. The
   served lane is authoritative; the harness adapts.

The epic is DONE when the served-page lane is green on main — not when the
individual hardening PRs merge.

**Status:** active — 8 days to deadline (2026-08-22). Orra's contract is
harness-green (#863, closed 2026-07-29) AND the served page already has a live
recognition lane (`orraRuntimeLane.ts`, landed 2026-07-28) — Mara's 2026-08-14
correction. What's missing is a served-page e2e that pins the three #863 red
modes to the deployed surface. This is a HARDENING + PROOF epic, not a
from-scratch wire. Sequence by time: the served offer → Orra-action → reload →
Orra-line chain is PLAYABLE today; the 08-22 gate is that the e2e catches all
three regression modes. Polish (feel envelope on the vigil action, sign-glow
parity with Io) is cuttable scope.

**Integration story (the done-gate — filed FIRST):** the epic's served-page e2e
drives Io beats → meet Orra → `light-vigil` or `spare-vigil` → reload → Orra
return line against the DEPLOYED surface, asserts the action-vs-first-contact
split AND Io non-regression, and turns RED under `orra-dropped` / `orra-wrong`
/ `orra-io-contamination` on the SERVED page (the #863 red modes, promoted from
harness to surface). M-ORRA-E1 is DONE when this lane is green on main.

**Reference:** #863 (closed) is the MODULE-lane proof of the same three
assertions in jsdom, over the `kind: "orra-recognition"` harness record.
M-ORRA-E1's integration proof is the orthogonal generalization: the same red
modes, but driven through the DEPLOYED page over the served `orraRuntimeLane`
vocabulary (`lit` / `spared`). The module-vs-surface gap M-WIRE closed for Io
is closed here for Orra by pinning the served lane to a page-driven e2e — not
by adding a second Orra pipeline.

---

## Story map (M-ORRA-E1)

ALL 5 stories filed as of 2026-08-14. Two hardening stories (#1174, #1175)
already MERGED; the done-gate #1173 and the two final hardening/reconciliation
stories (#1180, #1181) are OPEN. **8 days to the 2026-08-22 deadline.**

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Served-page Orra e2e (done-gate, filed FIRST)** — drive Io beats → meet Orra → `light-vigil` or `spare-vigil` → reload → Orra return line on the deployed page; assert action-vs-first-contact split + Io non-regression; RED under all three #863 modes | **#1173** | M | integration done-gate | **OPEN — IMPLEMENT NOW** |
| Harden Orra recognition persistence in `orraRuntimeLane`/main.js against `orra-dropped` — round-trip `OrraRecognitionMemoryFact[]` through save/restore so `selectOrraRecognitionLine` survives reload | **#1175** | M | hardening (persistence) | **MERGED ✅** |
| Harden `actionForOrraChoice` + return-line selection against `orra-wrong` — served scene must call `light-vigil` / `spare-vigil` through the classifier (no bypasses) and serve `ORRA_RETURN_LINE_BY_ACTION[action]` | **#1174** | M | hardening (action→line) | **MERGED ✅** |
| Isolate Orra memory from Io on the served page against `orra-io-contamination` — Io's returning-session selection must not read Orra state; add the assertion + fix any coupling | **#1180** | M | hardening (Io non-regression) | **OPEN — file order 1 of 2, feeds done-gate #1173** |
| Reconcile the #863 harness surface with the served lane — additive adapter mapping `kind: "orra-recognition"` ↔ `orraRuntimeLane`'s `lit`/`spared` so both stay honest; served lane is authoritative | **#1181** | S | reconciliation (1-in-4 harness) | **OPEN — file order 2 of 2, lowest priority (P2), cuttable** |

**Cap state (2026-08-14, updated this chunk):** the 3/3 open-issue cap FREED
when #1174 + #1175 merged. The two previously cap-blocked stories are now filed:
**#1180** (Io non-regression, `orra-io-contamination`, P1 — feeds the done-gate)
and **#1181** (reconciliation adapter, P2 — cuttable if the 08-22 gate is at
risk). Open work remaining for M-ORRA-E1: implement **#1173** (done-gate),
**#1180** (Io isolation), then **#1181** (reconciliation). Sequence by TIME: a
rough-but-PLAYABLE served Orra beat with the e2e catching all three red modes
beats a polished-but-partial one — cut #1181 before slipping 08-22.

**Integration-first note:** the done-gate e2e is filed FIRST and defines the
epic's outcome; the hardening stories are the fixes that turn it green. The
gate DRIVES the deployed page and asserts against the served surface, not the
jsdom harness. Per Mara's 2026-08-14 correction, Orra is NOT unwired — the
served lane exists (`orraRuntimeLane.ts` @ 2026-07-28); what's missing is a
served-page e2e that pins the three #863 red modes to it. #863 is the harness
twin (closed); this map spends only served-page hardening + one additive
adapter, so the harness ration (1-in-4) is untouched.

---

## Drift — open issues serving NO active epic

As of 2026-08-14 (this chunk), the open `agent-filed` backlog is exactly the
M-ORRA-E1 story set: **#1173** (done-gate), **#1180** (Io non-regression),
**#1181** (reconciliation adapter). All three serve the active epic — there is
NO drift to dispose this cycle. Every open issue maps to a Story-map row above.

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

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

### M-WIRE (DONE ✅) — a first-time phone player at game.oodim.com/aftersign FEELS the recognition beat, and Io remembers them next session

**Deadline was 2026-08-22.** SHIPPED early (verified 2026-08-14): the done-gate
issue **#1113 is CLOSED (2026-08-11)** and **main is GREEN** (all 6 workflows @
e9644cc). The epic's served-page integration e2e now exists and drives the
DEPLOYED surface end to end — `aftersign/e2e/flagship-surface-contract.spec.ts:554`,
test `"M-WIRE-EINT integration: served offer → preserve/open → deliver → reload →
return-next-session"`. All three July consumers are landed on the served entry
(`packetIntent`, `recognitionFeedback`, `ioReturningSession` — see the EINT epic
below). The module-vs-surface gap #954 measured is closed: the July contract
library has live consumers on `aftersign/main.js` AND a green served lane guards
them. A first-time phone player now FEELS the recognition beat, and Io remembers
their packet outcome next session. M-WIRE is player-shipped, not merely
harness-green — the distinction M1–M3 failed. Closed.

---

### M-ORRA (ACTIVE) — a SECOND character (Saint Orra) remembers you on the served page

**Deadline: 2026-08-22** (unchanged public demo date; see
docs/flagship/BRIEF.md "The deadline"). Cut scope before slipping this date;
state days-remaining when sequencing stories.

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

### M-ORRA active-milestone body (promoted from M4, 2026-08-14)

**Deadline: 2026-08-22 — 8 days remaining.** M-WIRE shipped early, so this
milestone inherits the founder's public demo date. Per the deadline rule: cut
scope before slipping. Orra's memory graph, cross-NPC memory, and new episodes
stay OUT — the falsifiable outcome is ONE second character remembering ONE
deliberate action on the served page. If 8 days is tight, ship gentle-touch OR
strike (one branch), not both.

**Why active now:** M-WIRE closed the module-vs-surface gap — the July contracts
have live consumers and a green served lane. M3-E1's Orra recognition (#863) is
HARNESS-GREEN but player-unshipped (zero consumers in `main.js`, per the plan's
M3 note). This milestone converts that stored capital into player-visible value
on the served page — the same "wiring counts double" move M-WIRE proved, applied
to the second character. NO memory graph, NO cross-NPC memory, NO new episode.

_Prior deferred body (kept for the acceptance detail; folded into M-ORRA):_

### M4-legacy (DEFERRED body, superseded by M-ORRA above) — A SECOND character remembers you on the served page (Orra, wired)

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

**Status:** active — **ALL THREE consumers are now LANDED on the served entry**
(`aftersign/main.js`, verified 2026-08-10 @ 60b9db25):
- `packetIntent` — imported lines 9-13 (`evaluatePacketIntent`,
  `PacketIntentController`, `PACKET_OUTCOME`); `PacketIntentController` is
  instantiated at `main.js:146` and drives the live tap-preserve / hold-open
  gesture (`press`/`release` at 868-870), with `evaluatePacketIntent` publishing
  a post-release verdict at 847-858. WIRED.
- `recognitionFeedback` — imported at `main.js:31` via
  `recognitionFeedbackBridge.ts` (`recognitionEnvelopeAt`) and consumed into the
  served `recognitionFeedback` block at 252-259 as MEASURED motion. WIRED.
- `ioReturningSession` — `chooseIoReturningSessionLine` imported at `main.js:41`
  and consumed on the returning-session path. WIRED.

The founder's zero-consumer measurement is **CLEARED**: the July contract
library now has live consumers on the served entry. This epic is no longer a
wiring epic — the only thing between it and player-shippable is a GREEN served
lane. Per #954's CONSUMER RULE the harness-only ration is untouched (no new
harness needed).

**Integration story (the done-gate):** the epic's served-page e2e
(`aftersign/e2e/flagship-surface-contract.spec.ts`) drives offer →
tap-preserve / hold-open → deliver → reload → return-next-session against the
deployed surface and asserts each wired beat. **It is currently RED on main
(#1113, P1)** — post-merge e2e failed @ 60b9db25. EINT is DONE when this lane
is green again on main; the repair is the top priority (prior red-main repairs
#1093, #1100 already landed + closed on this same epic).

**Integration story of M2 (reference):** #735 (merged) proved chained memory in
a MODULE lane. M-WIRE's integration proof is the orthogonal generalization: the
same beats, but driven through the DEPLOYED page — closing the module-vs-surface
gap that #954 measured and #863 exposed (M3 harness-green, player-unshipped).

---

## Story map (M-WIRE-EINT)

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Repair the served-page e2e RED on main (done-gate)** — decide SPEC-vs-SURFACE per `aftersign/src/ioRecognitionDialogue.ts`, land the fix so the offer → preserve/open → deliver → reload → return lane is GREEN on main | **#1113** | S/M | integration done-gate | **RED on main (P1) — top priority** |
| Wire `recognitionFeedback` into main.js — player FEELS the recognition beat on deliver | — | M | consumer (feel envelope) | **✅ LANDED** — `main.js:31` (bridge), consumed 252-259 |
| Wire the `packetIntent` feel model — tap preserves the seal, hold opens, with cancel/inspect | **#956** | M | consumer (offer/commit) | **✅ LANDED** — `main.js:9-13,146,847-870` |
| Wire Io returning-session lines (`ioReturningSession`) into the served scene | **#1002** | M | consumer (returning-session line) | **✅ LANDED** — `main.js:41` + #980/#985 |

**Integration-first note (updated 2026-08-10):** the three consumer stories are
all LANDED — every July module (`recognitionFeedback`, `packetIntent`,
`ioReturningSession`) now has a live consumer in `aftersign/main.js`, so the
module-vs-surface gap #954 measured is CLOSED at the import level. The only work
remaining for M-WIRE-EINT is the done-gate: the served-page e2e must be GREEN on
main. It is currently RED (#1113, P1) — the epic is DONE the moment that lane is
repaired. #1004 (the earlier "write the gate first" story) is superseded: the
gate lane already exists in `flagship-surface-contract.spec.ts`; the task is now
to keep it green, not to author it.

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M2-EINT work:

- **#1089** — [`type:bug` P2, infra] perf-budget e2e specs need a runner-speed
  calibration preflight; slow SwiftShader draws cause ~50% false RED. This is
  test-INFRASTRUCTURE reliability, not a served-page beat — but it is adjacent
  to the #1113 done-gate (false REDs on the same e2e lane can mask/mimic the
  gate's real signal). Keep OUT of the story map (it wires no consumer), but
  flag it to whoever repairs #1113 so a flaky perf preflight isn't mistaken for
  an unwired beat. Operator disposes.
- **#1071** — [June, `type:refactor` P3, agent-needs-human] AFTERSIGN red/green
  gate source exists but CI still keys off spec-comment markers. Process/tooling
  fix (the successor to the retired #727), not a served-page beat. Human-flagged.
- **#1065** — [Mara, `enhancement` P1, agent-needs-human] CI failure summary
  should include the raw e2e log when Playwright JSON is absent. CI ergonomics —
  no player surface. Human-flagged; does NOT enter the story map.
- **#1053** — [Mara, `enhancement` P2] root README still centers frozen games
  instead of the flagship workflow. Docs/onboarding drift, not a served-page
  beat. Operator disposes.
- **#1051** — [Soren, `enhancement` P3] Architecture README omits a flagship
  runtime verification contract row. Docs drift. Operator disposes.
- **#1081** — [Charlie, `enhancement` P2, agent-unroutable] e2e should drive
  `setMoveInput` before `assertFeelContract` to exercise input-to-render
  latency. This SHARPENS the #1113 feel-envelope assertion but is a test-quality
  refinement, not itself a served-page beat — fold into #1113's repair if
  convenient, else operator disposes.

_Retired prior-cycle drift: #976/#977/#978 and #727 no longer appear in the open
`agent-filed` backlog (disposed since the last cycle)._

_M3 (Saint Orra) is DEFERRED to M4, not drift: its harness-green integration
(#863) shipped in the contract lane but not on the served page, so its
served-page wiring is deliberately gated behind M-WIRE-EINT closing the
module-vs-surface gap first. Prior-cycle drift (#615/#622/#454/#634) resolved.
Current drift is #976/#977/#978 + #727 above._

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

### M-ORRA (SUPERSEDED 2026-08-14 — recognition DEPTH, not milestone progress) — a returning phone player meets a SECOND named character (Saint Orra) who remembers their action, on the served page

**Superseded by the founder amendment "The story proceeds" (2026-08-14, see
docs/flagship/BRIEF.md).** M-ORRA is a SECOND recognizer — recognition depth
inside the SAME loop. The founder disqualified exactly this class of work as
milestone progress: *"Depth inside the same loop — more recognizers, better
feel, harder tests — does not move [the ten-minute bar]."* The M-ORRA served
lane and its hardening stories (#1174, #1175 merged) remain legitimate
maintenance under the DoD ration, but they do NOT count toward the demo. The
active milestone is now **M-CONTINUE** below: the game must go ON past
`io-return-recognition`, not deeper into it. M-ORRA's done-gate work, if any
remains, is maintenance — not the demo gate.

---

### M-CONTINUE (DONE ✅ 2026-08-22, deadline day) — a phone player is driven PAST `io-return-recognition` into at least TWO new story beats: Io's return-tone answer, then Io hands them the NEXT job

**Deadline: 2026-08-22** (founder — the public demo date; see
docs/flagship/BRIEF.md "The deadline" + "The story proceeds" + "Played, not
driven"). **0 days remaining — DONE ON the deadline.** Cut scope INSIDE a scene
before slipping this date — but never below TWO new reachable beats, and never
the date.

**✅ DONE — PLAYED, not driven (2026-08-22, deadline day).** The founder's
2026-08-15 "Played, not driven" bar is MET: the tap-driven PLAYTEST
`aftersign/e2e/m-continue-phone-tap-playtest.spec.ts` (`hasTouch: true`,
`isMobile: true`, 390×844) plays a phone player from boot (`packet-offered`)
through `io-return-recognition` → `return-tone-choice` → `io-next-job` using
ONLY `.tap()` on the three visible DOM ids the served page exposes
(`#deliverButton`, `#acknowledgeRouteButton`, `#skipRouteButton` at
`aftersign/index.html:663-666`). It asserts each beat's dialogue RE-RENDERS
(`#line` text, button labels — "kind return"/"evasive return"/"blunt return",
"ask for next job", "deliver next packet") and reads `window.__game` for
invariant assertions only (`getSnapshot()` → `scene.beat`, `npcs.io.lastLine`),
never to CAUSE an action. The sibling `m-continue-playtest.spec.ts` +
`m-continue-tap-playtest.spec.ts` + `m-continue-visible-next-job-playtest.spec.ts`
corroborate the same journey. **CI on main is GREEN** (commit 6dd7088, all 6
workflows passed). The state machine advances AND the player can reach it by
taps alone — two new reachable beats past `io-return-recognition`, PLAYED.
M-CONTINUE is falsified-negative-proof and closed. The driven ladder
(#1216/#1198/#1199/#1200/#1202) all MERGED + CLOSED; one open extension beat
remains as POLISH (#1322, below) — the milestone is DONE with #1322 as polish,
NOT blocked on it (the ≥2-beat floor is already met by the two beats above).

<details><summary>Prior corrections 2026-08-15 → 2026-08-22 (resolved by the PLAYTEST going green)</summary>

**🔴 BOARD-VS-PLAN RECONCILIATION 2026-08-22 (chunk 1 of this cycle):** This
doc's body below still narrates the pre-#1296 world — the #1216 PLAYTEST
done-gate + Soren's #1198→#1199→#1200 driven ladder + #1202 next-job authoring
are ALL CLOSED and no longer on the board (confirmed: `list_issues` open =
{#1345, #1322, #1264}; closed `agent-filed` includes #1296 "Wire Io tone-choice
+ next-job beat into the served aftersign slice"). The two new served beats
`return-tone-choice` and `io-next-job` DID land on the served surface
(confirmed via grep: `io-next-job` is a served `AftersignStoryBeatId`, reachable
through `return-tone-choice` → `buildIoContinueBeats`, `bootWindowGame.ts:774`;
`flagshipSurfaceAlignment.test.ts:114` maps it; a phone-viewport playtest spec
is asserted to exist by `aftersignMilestoneAcceptanceSurface.test.ts:81`). So
M-CONTINUE's FLOOR — ≥2 tap-reachable beats past `io-return-recognition` — is
met on the served page. **Resolved in this cycle: the DONE flip above quotes
the founder bar and points at the green served-page playtest.**

**LAST OPEN E1 GAP — #1322:** `ioSecondPacketCopy.ts` (landed via #1319) is a
pinned three-tone copy module for Io's second-packet offer that **NO served
renderer consumes** — the words never reach `#line`/`#speaker`. This is the
exact "stored capital, not shipped value" failure the DoD forbids. #1322 wires
`selectIoSecondPacketCopy` into `main.js`'s `io-next-job` branch with a
tap-driven e2e. It is the remaining player-visible content on the next-job beat.
**Reclassified as POLISH past the M-CONTINUE floor** — the ≥2-beat floor is
already met by `return-tone-choice` + `io-next-job`; #1322 wires a THIRD beat.

**⚠️ REALITY CORRECTION 2026-08-15 (founder amendment "Played, not driven"):
M-CONTINUE was OPEN because the acceptance spec was driven, not played.** The
two new beats (`return-tone-choice`, `io-next-job`) now EXIST on the served
surface (`AftersignStoryBeatId` in
`apps/web/src/aftersign/windowGameSurface.ts:26-36`; beat derivation at
`:264-334`) and the done-gate e2e
(`aftersign/e2e/m-continue-served-beats.spec.ts`) is green — BUT that spec
drives every action through `window.__game.input.choose(...)`
(`choose('keep-sealed')` … `choose('choose-return-tone')` …
`choose('ask-for-next-job')`), the harness INPUT surface. The founder's
2026-08-15 amendment disqualifies exactly this as acceptance evidence:
*"Calling `window.__game.input.*` … to CAUSE a player action disqualifies the
test as acceptance evidence."* A player has no `choose()` bridge — nothing on
the rendered page taps into these beats. Per the amendment, *"If a beat cannot
be reached by taps alone, it is NOT DONE."* **The state machine advances; the
player cannot.** M-CONTINUE's done signal is now a PLAYTEST spec (below), not
the driven e2e.

</details>

**Founder bar, quoted VERBATIM from the 2026-08-14 amendment "The story
proceeds" in `docs/flagship/BRIEF.md` (declaring DONE requires quoting this and
pointing at the served-page e2e that proves it):**
> After Io's return recognition, the game GOES ON: wire the authored script
> through scene 8 (the return-tone choice), then author and wire the beat it
> was written to feed — Io hands the player the **next job**. The packet loop
> continues WITH the story, not despite it.
>
> Acceptance: a served-page e2e drives a player PAST `io-return-recognition`
> into at least TWO beats that do not exist today, on the phone-shaped
> viewport.

**The milestone METRIC is beats reachable on the served page** (the founder's
words — an EXTENT claim, not a depth claim). Today the served page's terminal
beat is `io-return-recognition` (confirmed: `AftersignStoryBeatId` in
`apps/web/src/aftersign/windowGameSurface.ts`; `flagshipSurfaceAlignment.test.ts`
maps every served beat and none follows the recognition beat). The authored
script's **scene 8 return-tone choice** (`returnTone: 'kind' | 'evasive' |
'blunt'`, `docs/flagship/vertical-slice-script.md`) has contract coverage in
`packages/aftersign/src/narrative-triage/io-recognition-beat.ts`
(`RETURN_TONE_BEATS`) and `io-memory-lines.ts` — but ZERO references in the
served surface (`apps/web/src/aftersign/`). It is authored + contract-covered
stored capital, unwired. That is beat #1 to reach the player.

**Observable outcome (falsifiable on the DEPLOYED page):** A returning phone
player at game.oodim.com/aftersign — one Io already recognizes — hears Io's
recognition line (`io-return-recognition`, exists today) and then the game
CONTINUES:
1. **Scene 8 — return-tone choice (new served beat #1).** Io offers the three
   authored responses (kind / evasive / blunt). The player picks one; Io speaks
   the authored answer for that tone (`RETURN_TONE_BEATS` copy), and `returnTone`
   is set and persisted.
2. **The next job (new served beat #2).** Io hands the player a NEW packet /
   delivery — the packet loop continues WITH the story. This beat does not exist
   in script or code today; it is authored (a scene-9 stub in
   `vertical-slice-script.md`) AND wired to the served page in the same
   milestone.

Both beats are reachable by a stranger with a phone in one continuous session
after their recognition. Recognition depth (Orra, feel envelopes, harder red
modes) is explicitly OUT — it does not move the beats-reachable metric.

**Why this is the next-smallest outcome:** the founder measured the exact gap —
"the wiring stopped" at `io-return-recognition` while scene 8 sits authored and
contract-covered. The smallest honest step that moves the metric is to wire the
already-authored scene 8, then author + wire ONE more beat so the loop visibly
CONTINUES rather than terminates. Two new reachable beats is the founder's floor.

**Definition of done (falsifiable, served-page, PLAYED not driven — quote the
founder bar above to declare DONE):**
- On a phone-shaped viewport at game.oodim.com/aftersign: a returning player
  reaches `io-return-recognition`, then a **tap-driven PLAYTEST spec**
  (Playwright pointer/tap events on rendered, VISIBLE DOM elements — NOT
  `window.__game.input.*`) taps them into the **return-tone choice** (three
  visible options render → tap one → Io's authored tone-answer RE-RENDERS in
  the visible dialogue → `returnTone` persists) and then into **the next-job
  beat** (Io's new-packet line renders; the delivery loop re-opens on screen).
- The PLAYTEST spec asserts each VISIBLE dialogue change (rendered DOM text),
  not just `story.beat`. `window.__game` is read ONLY to assert invariants
  (`completedBeats` advanced ≥2 past `io-return-recognition`) — never to CAUSE
  an action. A beat whose line never renders in the DOM was never spoken.
- Io's existing recognition line is UNCHANGED (no regression on the beats that
  already ship).
- The return-tone consumer imports the existing contract
  (`RETURN_TONE_BEATS` / `io-memory-lines.ts`) into the served page — wiring
  stored capital INTO the surface counts double per the DoD.
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface, and the milestone metric is beats reachable on the served page.

**LoE budget:** ~1 epic (E1: wire scene 8 into the served page, author + wire
scene 9 "the next job", prove ≥2 new reachable beats with a served-page e2e).
Orra depth, a memory graph, cross-NPC memory, new characters, and branching
episodes remain OUT — later milestones.

---

## Active milestone (M-CONTINUE) — epics

### E1 (ACTIVE) — the served page continues past `io-return-recognition` into the return-tone choice and then a new next-job beat, proven end to end

**Acceptance criteria:** the served entry (`apps/web/aftersign/main.js` +
`apps/web/src/aftersign/windowGameSurface.ts`'s `AftersignStoryBeatId`) today
terminates at `io-return-recognition`. E1:
1. Adds two new beat IDs to `AftersignStoryBeatId` and wires the served page to
   advance into them after recognition: a **return-tone** beat and a
   **next-job** beat.
2. Wires the return-tone beat to CONSUME the existing contract
   (`RETURN_TONE_BEATS` in `packages/aftersign/src/narrative-triage/io-recognition-beat.ts`,
   copy in `io-memory-lines.ts`) — the served scene offers kind/evasive/blunt,
   serves the authored answer, and persists `returnTone`. This converts stored
   spec-capital into product (counts double under the DoD).
3. Authors scene 9 "the next job" in `docs/flagship/vertical-slice-script.md`
   (Io hands a new packet, the delivery loop re-opens) and wires it as the
   second new served beat.
4. Adds ONE integration e2e that drives `game.oodim.com/aftersign` on a
   phone-shaped viewport PAST `io-return-recognition` into BOTH new beats,
   asserting `story.beat` / `completedBeats` advance and Io's recognition line
   does not regress.

The epic is DONE when the served-page e2e is green on main and a player reaches
≥2 new beats — not when the individual PRs merge.

**Status:** active — 7 days to deadline (2026-08-22). **CORRECTED 2026-08-15
(chunk 3 — "Played, not driven"):** the driven integration spec
`aftersign/e2e/m-continue-served-beats.spec.ts` (PR #1195) is GREEN — wiring
for `return-tone-choice` / `io-next-job` landed via #1198/#1199/#1200 — but it
drives every action through `window.__game.input.choose(...)`, so under the
2026-08-15 amendment it is a HARNESS test, not acceptance evidence. **The true
done-gate is the tap-driven PLAYTEST spec #1216**: it plays boot → `io-next-job`
by Playwright TAPS on visible DOM elements only, asserting each new dialogue
line RENDERS in the DOM, reading `window.__game` for invariants only. #1216
goes RED FIRST if the rendered page has no tappable elements for the new
choices (likely — nothing on screen calls them today); the WIRING in
`aftersign/main.js` to render + re-render those beats is the fix. The green
flip of #1216 IS the epic's done signal. Open issues serving E1: **#1216**
(PLAYTEST done-gate, true done-flip), Soren's driven wiring ladder
#1198→#1199→#1200 (decomposed from closed #1196, with the beat-union prereq
#1197 already CLOSED 2026-08-14) plus June's next-job authoring #1202. See
the story map below for the blocked-by sequence and critical-path flags.
Sequence by TIME: a rough-but-PLAYABLE
two-beat continuation with the e2e proving reachability beats a polished-partial
one — the 08-22 gate is ≥2 new reachable beats on the served page.

**Integration story (the done-gate — to be filed FIRST):** the epic's
served-page e2e drives a returning phone player past `io-return-recognition`
into the return-tone beat (pick tone → authored answer → `returnTone` persists)
and into the next-job beat (new packet offered), asserting `completedBeats`
advances by ≥2 beyond recognition and Io's recognition line is unchanged.
M-CONTINUE-E1 is DONE when this lane is green on main.

**Reference:** scene 8's tone contract already exists in
`packages/aftersign/src/narrative-triage/` (`RETURN_TONE_BEATS`,
`io-memory-lines.ts`) — E1 wires it into the surface rather than re-authoring
it. Scene 9 is genuinely new and must be authored before it is wired.

---

## Story map (M-CONTINUE-E1) — DONE ✅ 2026-08-22

**CLOSED OUT 2026-08-22 (deadline day, 0 days remaining).** The entire driven
ladder (#1216 PLAYTEST done-gate, #1197 beat-IDs, #1198 state axes, #1199 choice
handlers, #1200 driven-smoke green, #1202 next-job authoring) is **MERGED +
CLOSED**. The founder's "Played, not driven" bar is MET on main: the tap-driven
PLAYTEST `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts` plays boot →
`io-return-recognition` → `return-tone-choice` → `io-next-job` by `.tap()` on
visible DOM ids only, asserting each dialogue re-render, `window.__game`
read-only for invariants. CI on main is GREEN. **M-CONTINUE-E1 is DONE.**

The ONE open E1-adjacent issue is an EXTENSION beat, not a blocker — it is
POLISH past the milestone floor:

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Wire `ioSecondPacketCopy` into a beat AFTER `io-next-job`'s HANDOFF line** — Io hands a *second packet* (directing the player to Saint Orra), consuming `selectIoSecondPacketCopy({ returnTone, playerName })` from `aftersign/src/ioSecondPacketCopy.ts` (pinned by `runIoSecondPacketCopyChecks`, PR #1319, currently rendered NOWHERE). Adds a tap-driven e2e asserting the rendered lines verbatim per tone. **POST-DEADLINE POLISH — the M-CONTINUE ≥2-beat floor is already met by `return-tone-choice` + `io-next-job`; this is a THIRD beat that extends the loop, not a blocker.** | **#1322** | M | consumer wire-in (stored-capital → surface) | OPEN (polish, unblocked) |

**Milestone verdict:** M-CONTINUE is **DONE-with-#1322-as-polish**, NOT
done-pending-#1322. The founder's floor was TWO new tap-reachable beats past
`io-return-recognition`; both (`return-tone-choice`, `io-next-job`) render and
are tap-reachable and green on main. #1322 wires a THIRD beat (the second
packet + Orra hand-off) that converts the #1319 pinned copy from stored capital
into product — valuable, but strictly additive. It carries no milestone gate.

**Next milestone — RE-POINTED BY THE FOUNDER (2026-08-22): M-LOOP (now ACTIVE, authored below).**

---

## Milestones (cont.) — M-LOOP

### M-LOOP (ACTIVE 2026-08-22) — a phone player finishes round one and can answer "what will you do differently next round?" — because memory changed which ACTIONS are available, not just what Io says

**Deadline: 2026-09-05** (spec-writer estimate — set 2 weeks past the 08-22
demo, as no founder date exists for M-LOOP in `docs/flagship/BRIEF.md`; the
founder's "The loop" amendment carries no date. **OPEN QUESTION for the
founder: confirm or set the M-LOOP demo date.**). **14 days remaining as of
2026-08-22.** Cut scope INSIDE the loop before slipping the date — but never
below the divergence bar (see below), and never the date. Sequence stories by
TIME REMAINING: a rough-but-PLAYABLE one-channel payback (e.g. a job appears
or disappears) with the divergence spec green beats a polished multi-channel
loop that isn't reachable by taps.

**Founder bar, quoted VERBATIM from the 2026-08-22 amendment "The loop" in
`docs/flagship/BRIEF.md` (declaring DONE requires quoting this and pointing at
the divergence spec):**
> **M-LOOP metric: divergence.** Two save-states with different memory
> records MUST produce different AVAILABLE ACTIONS on the served page —
> different job offers, prices, or open routes; dialogue-only differences
> score zero.
>
> **Acceptance (played, not driven):** a taps-only phone-viewport spec seeds
> two divergent saves, plays one round from each, and asserts the two runs
> offered DIFFERENT tappable actions (element-level, not text-level). Plus
> the standing playtest spec extended to complete TWO consecutive rounds.
>
> **Definition of DONE for the milestone:** a stranger finishes round one and
> can answer "what will you do differently next round?" — the retell bar
> upgraded to a replay bar.

**The milestone METRIC is DIVERGENCE** (the founder's word — it SUPERSEDES
beats-reachable from this amendment forward). Dialogue-only differences score
ZERO. The two standing guard rules (beats-reachable, played-not-driven) carry
over unchanged as guard rules; divergence is the milestone gate.

**The core loop the milestone must make reachable (one round ≈ 2–3 min, from
the amendment):**
1. **TAKE A JOB.** Io offers 1–3 delivery jobs; WHICH jobs exist is COMPUTED
   from the player's memory record (trust posture, prior outcomes, debts). A
   first-time player sees one safe job; a trusted courier sees riskier/stranger
   ones.
2. **RUN THE ROUTE.** The delivery is a real traversal with ONE risk choice per
   run (long lit stair vs short dark cut; wait out the bell vs move through it).
   Risk taken/avoided is recorded as a FACT.
3. **DELIVER AND ANSWER.** Outcome + tone recorded (already built —
   `return-tone-choice` / recognition are shipped).
4. **THE WORLD PAYS IT BACK.** On return (this run or later) a memory
   MECHANICALLY matters: a job appears/disappears, Orra's price moves, a
   shortcut unlocks, an opened packet comes back as a consequence. NEVER only a
   line of dialogue.

**What exists today vs. the gap (grep-confirmed @ 014612d):** the served page
terminates at `io-next-job` — an offer beat — but the offer is FIXED, not
computed from memory. There is no `availableJobs` / `selectJobs` derivation
keyed on the memory record, no route-traversal-with-risk-choice, and no
risk-fact recording on the served surface (grep for
`availableJobs|selectJobs|routeChoice` in `apps/web/src/aftersign/` returns
only the fixed `io-next-job`/`nextJobOfferFeel` offer plumbing — no
memory-computed job set, no route/risk axis). **That absence IS M-LOOP:** wire
the job set to be COMPUTED from memory (channel 1: TAKE A JOB), and add ONE
route risk choice recorded as a fact that changes a later round's available
actions (channels 2 + 4). Channel 3 is already shipped.

**Observable outcome (falsifiable on the DEPLOYED page):** Two phone players
with DIFFERENT memory records (one first-time / low-trust, one who ran a risky
route and delivered) reach the job-offer beat and are offered DIFFERENT
TAPPABLE actions — a different job set, a different price, or a different open
route — at the element level, not just different Io lines. A single player who
completes a round and returns finds their available actions CHANGED by what
they did (a job appeared/disappeared, a price moved, or a shortcut unlocked).

**Why this is the next-smallest outcome:** M-CONTINUE proved the story
CONTINUES to an offer beat; the offer is inert (same for everyone). The
smallest honest step that satisfies DIVERGENCE is to make ONE channel of the
offer computed from memory (job set) plus ONE route risk fact that feeds back
into a later round's available actions. That is the minimum that makes two
divergent saves produce different tappable actions. A full memory graph,
multi-channel payback (price AND route AND packet-callback all at once),
Orra's price economy, and new NPCs remain OUT — later milestones.

**Definition of done (falsifiable, served-page, PLAYED not driven — quote the
founder bar above to declare DONE):**
- On a phone-shaped viewport at game.oodim.com/aftersign: a **taps-only
  DIVERGENCE spec** (Playwright pointer/tap on rendered VISIBLE DOM elements —
  NOT `window.__game.input.*`) seeds TWO saves with different memory records,
  plays one round from each, and asserts the two runs offered DIFFERENT
  tappable actions at the ELEMENT level (different job buttons / prices / open
  routes — a text-only difference FAILS the spec).
- The **standing PLAYTEST spec** is extended to complete TWO consecutive rounds
  by taps only (take job → run route with a risk choice → deliver → return →
  the world's payback is a changed available action), asserting each visible
  dialogue change AND the changed available action after round one.
- `window.__game` is read ONLY to assert invariants (the memory record differs
  between the two seeded saves; a risk fact was recorded) — NEVER to CAUSE an
  action.
- No regression: Io's recognition line and the `return-tone-choice` /
  `io-next-job` beats already shipping stay reachable by taps.
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface and the metric is DIVERGENCE.
- Human playtest evidence (a stranger answers "what will you do differently
  next round?") is recorded in the devlog per the amendment — not CI-able, but
  required for the milestone DONE flip alongside the green divergence spec.

**LoE budget:** ~1 epic (E1: memory-computed job set + one recorded route-risk
fact that changes a later round's available actions, proven by a served-page
divergence spec). Multi-channel payback, Orra's price economy, a memory graph,
cross-NPC memory, and new NPCs are OUT — later milestones. Scope discipline
per the amendment: ONE scene; NO new NPCs before both existing ones pay
memories back mechanically.

---

## Active milestone (M-LOOP) — epics

### E1 (ACTIVE) — the served page's job offer is COMPUTED from the player's memory record, and one route-risk fact changes a later round's available actions — proven by a taps-only divergence spec

**Acceptance criteria:** the served entry (`apps/web/aftersign/main.js` +
`apps/web/src/aftersign/`) today serves a FIXED `io-next-job` offer. E1:
1. Wires the job offer at the `io-next-job` beat to be **computed from the
   memory record** — a first-time / low-trust player sees one (safe) job; a
   player whose record shows a delivered risky run sees a different job set,
   price, or open route. The computed set renders as DIFFERENT tappable DOM
   elements per save.
2. Adds ONE **route risk choice** on the delivery run (e.g. long-lit vs
   short-dark) that renders as tappable options and records the choice as a
   FACT in the memory record on the served page.
3. Wires ONE **payback channel** so that recorded risk fact CHANGES a later
   round's available actions (a job appears/disappears, a price moves, or a
   shortcut unlocks) — a mechanical change to tappable elements, never only a
   dialogue line.
4. Adds the **divergence integration spec** (the done-gate, filed FIRST): a
   taps-only phone-viewport Playwright spec seeds two divergent saves, plays a
   round from each, and asserts the two runs offer DIFFERENT tappable actions
   at the element level; `window.__game` read-only for invariants.

The epic is DONE when the served-page divergence spec is green on main and two
divergent saves produce different available actions by taps — NOT when the
individual wiring PRs merge.

**Status:** active — **6 days to deadline (2026-09-05, spec-writer estimate,
founder to confirm; as of 2026-08-30)**. The divergence DONE-GATE is PARTIAL
on the served surface: guard `aftersignMemoryDivergencePlaytestSurface.test.ts`
plus the taps-only spec `job-offers-played.spec.ts` run in the default CI lane
and assert element-level action-set divergence between two seeded saves. The
sibling spec `m-loop-e1-phone-action-divergence.spec.ts` is `test.describe.skip`
gated on `M_LOOP_E1_IMPL_LANDED=1` and its own header calls itself "RED until
the impl story lands" — it does NOT count toward the gate today. The action-id
divergence wiring (#1535, closed) landed the `firstRun`/`trusted`/`opened`
offer branches through the canonical `input.choose("take-job-<id>")` path.
What remains for E1: make that divergence LEGIBLE to a tapping player
(route/risk copy visible on the offer — #1551), stitch the two divergence
beats into ONE boot→round1→return→round2 taps-only journey (#1552), and land
the impl that flips `m-loop-e1-phone-action-divergence.spec.ts` from skipped
to green in the default lane. #1322 (June) folded into M-CONTINUE polish and
CLOSED 2026-08-24 — Io's second-packet copy is no longer an open E1 payback
channel; a fresh, memory-computed second-packet story would need to be filed
if we want that payback in-loop.

**Integration story (the done-gate — to be filed FIRST next chunk):** the
epic's served-page taps-only DIVERGENCE spec seeds two saves with different
memory records, plays one round from each on the phone viewport, and asserts
the two runs offered DIFFERENT tappable actions (element-level), reading
`window.__game` for invariants only. M-LOOP-E1 is DONE when this lane is green
on main.

**Reference:** the recorded-outcome + tone plumbing (channel 3) already ships
(`return-tone-choice`, recognition). E1 adds channels 1 (memory-computed job
set), 2 (route risk fact), and 4 (mechanical payback) — the wiring that makes
persistence LOAD-BEARING rather than a recognition trick.

---

## Story map (M-LOOP-E1) — **6 days to deadline (as of 2026-08-30)**

**Reality reconciliation (2026-08-30):** the divergence DONE-GATE is NOT a
pending #1370 — it PARTIALLY exists on the served surface. Guard
`aftersignMemoryDivergencePlaytestSurface.test.ts` + the taps-only spec
`job-offers-played.spec.ts` run in the default CI lane and assert two seeded
saves produce element-level DIFFERENT tappable actions. The sibling spec
`m-loop-e1-phone-action-divergence.spec.ts` is `test.describe.skip` gated on
`M_LOOP_E1_IMPL_LANDED=1` — RED-until-impl, not counted toward the gate today.
The action-id divergence wiring landed via **#1535 (closed)** — the
`firstRun`/`trusted`/`opened` offer branches route through the canonical
`input.choose("take-job-<id>")` path. The prior chunk's #1370/#1371/#1372 map
rows are SUPERSEDED by that landed work (do not re-derive; verify against the
guard + `job-offers-played.spec.ts`). With 6 days left, sequence the remaining
stories by TIME: make the divergence LEGIBLE (#1551), stitch the two-round
journey (#1552), and land the impl that un-skips
`m-loop-e1-phone-action-divergence.spec.ts` in the default lane.

Every story carries at the TOP of its body:

```
Milestone: M-LOOP — a phone visitor can complete a job for Io, leave, return, and see the loop remember them (offers diverge on the second run)
Epic: M-LOOP-E1 — the served aftersign page offers a DIFFERENT visible action set on a looped return than on first run, driven only by taps
```

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Divergence done-gate (partially shipped)** — element-level action-set divergence between two seeded saves, taps-only, `window.__game` invariant-only | guard `aftersignMemoryDivergencePlaytestSurface.test.ts` + `job-offers-played.spec.ts` (running); `m-loop-e1-phone-action-divergence.spec.ts` (skipped, gated on `M_LOOP_E1_IMPL_LANDED=1`) | M | integration done-gate | **PARTIAL** — guard + `job-offers-played.spec.ts` green in default CI lane; skipped sibling un-skips when the un-skip impl lands |
| **Action-id divergence wiring** — `firstRun`/`trusted`/`opened` offer branches through canonical `input.choose("take-job-<id>")` | **#1535** | M | consumer wire-in (record → action set) | **CLOSED ✅** |
| **Surface route + risk copy on the served offer (make divergence LEGIBLE)** — render each branch's `route`/`risk` copy as VISIBLE text so a phone player READS the loop diverge across `firstRun`/`trusted`/`opened`; consumer assertion via `getByText`/`getByRole` | **#1551** | M | consumer wire-in (copy → surface) | **filed 2026-08-30** |
| **Two-round phone PLAYTEST (boot→round1→return→round2)** — one taps-only phone-viewport spec stitches the two divergence beats into a single journey; asserts round-2 offer set VISIBLY differs from round-1 and each visible change along the way (≤1-in-4 harness-adjacent) | **#1552** | M | playtest (2-round loop) | **filed 2026-08-30** |
| **Mechanical payback channel — Io second-packet hand-off diverges by record** — consume `selectIoSecondPacketCopy` (`aftersign/src/ioSecondPacketCopy.ts`) as a payback whose TAPPABLE presence diverges by memory record | ~~#1322~~ (CLOSED 2026-08-24 as M-CONTINUE polish; not an open E1 payback story) | M | consumer wire-in (payback channel) | **CLOSED** — no open story today; file a fresh memory-computed second-packet story if we want this payback in-loop |

**Integration-first note:** the done-gate LEADS partially — the guard +
`job-offers-played.spec.ts` are green on the served surface in the default
CI lane, so the integration-first rule is satisfied by that landed work for
the shipped surface. `m-loop-e1-phone-action-divergence.spec.ts` remains
`test.describe.skip` (`M_LOOP_E1_IMPL_LANDED=1`) and un-skips when its impl
story lands. #1551 makes the divergence a human can READ; #1552 is the
milestone PLAYTEST (boot→two rounds, taps only). #1322 is CLOSED (M-CONTINUE
polish) — if we want a memory-computed Io second-packet payback in-loop, it
needs a fresh story filed against E1, not a re-open.

---

## M-CONTINUE closed-out record [provenance — see M-LOOP above for the active milestone]

_The M-CONTINUE milestone body, E1 epic, and DONE ✅ story map above this
line are the closed-out record for the 08-22 demo milestone. The ACTIVE
milestone is M-LOOP (authored above). #1322 remains open as M-CONTINUE polish
but is re-homed into M-LOOP-E1 as a loop story (see E1 status). Do not action
M-CONTINUE as active — it is DONE._

---

## Drift — open issues serving NO active epic

**Corrected 2026-08-15 (chunk 2 — "Played, not driven").** All open
`agent-filed` issues serve M-CONTINUE-E1 — **NO drift** this cycle. **7 days to
deadline (2026-08-22).** Every open issue is mapped in the story map above:

- **#1216** — the TAP-driven PLAYTEST done-gate (NEW this cycle). It is the
  TRUE milestone done-flip; #1199/#1200's driven spec is demoted to
  harness-only evidence.
- **#1198 / #1199 / #1200** — Soren's driven wiring ladder, decomposed from the
  (closed) wiring epic **#1196**. #1197 CLOSED 2026-08-14 (retained for
  provenance). These build the state axes + choice handlers #1216 taps into;
  #1200 (un-`test.fail` the driven smoke) is now OFF the done-flip critical
  path.
- **#1202** — June's next-job (Orra name-debt) authoring+wiring story. Serves E1
  (authors the `io-next-job` beat content #1216 must reach by taps).

**Routing risk to watch (not drift, but flagged):** #1198 and #1202 carry the
`agent-unroutable` label — the backlog picker may not auto-assign them. They are
on E1's critical path (#1198 is the head of the live ladder gating
#1199→#1200; #1202 gates the #1200 done-flip), so if they sit unrouted the
08-22 gate slips. Operator should hand-route or clear the `agent-unroutable`
flag on these two.

_Prior-cycle drift resolved / disposed: the M-ORRA story set (#1173, #1180,
#1181 — all closed) and the M-WIRE-cycle set (#1089/#1071/#1065/#1053/#1051/#1081);
earlier #976/#977/#978/#727 and #615/#622/#454/#634. M-ORRA is now SUPERSEDED
recognition-depth, not the active milestone — its merged hardening (#1174,
#1175) is maintenance capital, not demo progress._

---

## M-ORRA milestone body [RETIRED 2026-08-14 — provenance only]

> ⚠️ Everything in this fenced block is the RETIRED M-ORRA milestone body
> (Deadline → Observable outcome → Why-next-smallest → DoD → LoE budget),
> preserved verbatim for provenance. It is NOT the active milestone spec.
> The active milestone spec is **M-CONTINUE** ABOVE. Do not action anything
> inside this block.

> **Deadline: 2026-08-22** (founder — the public demo date; see
> docs/flagship/BRIEF.md "The deadline"). **8 days remaining as of 2026-08-14.**
> Cut scope before slipping this date; sequence stories by TIME REMAINING — a
> rough-but-PLAYABLE second-character beat beats a polished-but-partial one.
>
> **Observable outcome (falsifiable on the DEPLOYED page):** A returning phone
> player at game.oodim.com/aftersign — one Io already recognizes (M-WIRE) — meets a
> DIFFERENT named character in the same slice: **Saint Orra**, the living sign over
> the old pharmacy. They perform ONE deliberate action toward Orra
> (**light-vigil** → `lit` vs. **spare-vigil** → `spared`, per
> `aftersign/src/orraRuntimeLane.ts`'s `ORRA_CHOICE_TO_ACTION`), leave, and return
> in a later session. On return **Orra speaks a line that references THAT action**
> (`orra_return_lit_vigil` / `orra_return_spared_vigil`) — proving the memory
> mechanic is a property of the WORLD, not welded to Io. Io's own recognition is
> UNTOUCHED: the same returning player still hears Io's correct returning-session
> line. A control player who never touched Orra hears Orra's first-contact line,
> visibly distinct from the recognition line. Every beat is served by wired page
> code — the epic's e2e drives the deployed surface end to end.
>
> **Why this is the next-smallest outcome:** M-WIRE proved the July contract
> library reaches the PLAYER (Io's recognition felt + remembered on the served
> page). Orra's served page ALREADY HAS a live recognition lane — `main.js`
> imports `actionForOrraChoice` / `buildOrraRecognitionMemoryFact` /
> `selectOrraRecognitionLine` from `orraRuntimeLane.ts` and consumes them at
> `main.js:23-28, 147, 1102-1129, 1303, 2111` (landed 2026-07-28). A player who
> chooses `light-vigil` and returns DOES hear Orra remember them today. What's
> STILL stored-capital is the #863 harness contract surface
> (`meetOrraForAftersignSlice`, `sampleAftersignOrraMemoryBeat`,
> `orraIndependentRecognition.integration.test.ts`) — genuinely unimported by
> `main.js`, and asserting the three red modes (`orra-dropped`, `orra-wrong`,
> `orra-io-contamination`) only in jsdom. This milestone therefore does NOT wire
> Orra from scratch. It (a) HARDENS the existing `orraRuntimeLane` on the served
> page against those three failure modes, (b) proves them with a served-page e2e
> (not the jsdom harness), and (c) reconciles vocabulary — the served lane speaks
> `lit`/`spared`; the #863 harness uses the parallel `kind: "orra-recognition"`
> record shape. It is the smallest honest step toward "a world whose people know
> your name": a SECOND independent recognizer proven ON the deployed surface. A
> memory *graph*, cross-NPC memory (Orra referencing an Io beat), Niko / Maud /
> the Child, and branching episodes remain OUT — M5+.
>
> **Reconciliation with `orraRuntimeLane` (explicit):** M-ORRA-E1 keeps and extends
> `orraRuntimeLane.ts` — it is NOT replaced. Any bridge to the #863 harness shape
> is additive (persistence adapter / test-only sampler), so the served-page
> vocabulary of record stays `lit` / `spared`. If a future story finds the two
> shapes genuinely incompatible, the tie-breaker is: served lane wins, harness
> adapts.
>
> **Definition of done (falsifiable, served-page):**
> - On a phone at game.oodim.com/aftersign: complete the Io beats (M-WIRE), meet
>   Saint Orra, perform the Orra action (`light-vigil` → `lit` OR `spare-vigil`
>   → `spared`, per `ORRA_CHOICE_TO_ACTION`), reload → **Orra** serves the
>   matching return line (`orra_return_lit_vigil` / `orra_return_spared_vigil`)
>   on the served page. The existing `orraRuntimeLane.ts` selectors are the
>   consumer, hardened; no new parallel lane is introduced.
> - The SAME returning player still hears Io's correct returning-session line —
>   Orra's memory does not regress or contaminate Io's.
> - A control player who never interacts with Orra hears Orra's first-contact line
>   (`ORRA_FIRST_CONTACT_LINE_ID`), NOT a recognition line.
> - The epic's integration e2e DRIVES THE DEPLOYED PAGE (not the jsdom harness) and
>   turns RED under the three #863 red modes, now asserted on the served surface:
>   `orra-dropped` (recognition lost across reload), `orra-wrong` (return line
>   doesn't match `lit`/`spared`), `orra-io-contamination` (Orra memory perturbs
>   Io's returning-session line).
> - No `harness-only`-labelled PR closes this milestone: the gate is the served
>   surface (harness-only rationed to 1-in-4 per the amendment; #863 already spent
>   the harness — this milestone spends only served-page hardening + e2e).
>
> **LoE budget:** ~1 epic (E1: wire Orra's existing recognition contract into the
> served page and prove it end to end). A memory graph, cross-NPC memory, new
> characters, and branching episodes remain OUT — M5+.

---

## Active milestone (M-ORRA) — epics [RETIRED 2026-08-14 — see M-CONTINUE above]

_M-ORRA-E1 was recognition depth (a second recognizer), which the founder's
2026-08-14 amendment disqualified as milestone progress. The active epic is now
M-CONTINUE-E1 (above). The retired M-ORRA-E1 detail is preserved below for
provenance only — it is maintenance capital, not the demo gate._

### E1 (RETIRED) — the existing served Orra recognition lane is hardened against the three #863 red modes, on the deployed page, and proven end to end

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

## Story map (M-ORRA-E1) [RETIRED 2026-08-14 — superseded by "Story map (M-CONTINUE-E1)" above]

> ⚠️ Everything from here to end-of-file is the RETIRED M-ORRA story map and its
> stale Drift section, preserved for provenance. The CURRENT story map and Drift
> section are the M-CONTINUE ones ABOVE. Do not action anything below this line.


ALL 5 stories filed and RESOLVED as of 2026-08-14 (retired-block provenance,
consistent with the live M-CONTINUE Drift section above that reports zero open
`agent-filed` issues). Two hardening stories (#1174, #1175) MERGED; done-gate
#1173, Io non-regression #1180, and reconciliation adapter #1181 all CLOSED
2026-08-14. This retired block is preserved for provenance; the demo gate is
M-CONTINUE, not this.

| Story | Issue | Size | Role | Status |
|-------|-------|------|------|--------|
| **Served-page Orra e2e (done-gate, filed FIRST)** — drive Io beats → meet Orra → `light-vigil` or `spare-vigil` → reload → Orra return line on the deployed page; assert action-vs-first-contact split + Io non-regression; RED under all three #863 modes | **#1173** | M | integration done-gate | **CLOSED ✅ 2026-08-14** — assertions landed in `aftersign/e2e/flagship-surface-contract.spec.ts` (`light-vigil`/`spare-vigil` beat loop + three red modes wired) |
| Harden Orra recognition persistence in `orraRuntimeLane`/main.js against `orra-dropped` — round-trip `OrraRecognitionMemoryFact[]` through save/restore so `selectOrraRecognitionLine` survives reload | **#1175** | M | hardening (persistence) | **MERGED ✅** |
| Harden `actionForOrraChoice` + return-line selection against `orra-wrong` — served scene must call `light-vigil` / `spare-vigil` through the classifier (no bypasses) and serve `ORRA_RETURN_LINE_BY_ACTION[action]` | **#1174** | M | hardening (action→line) | **MERGED ✅** |
| Isolate Orra memory from Io on the served page against `orra-io-contamination` — Io's returning-session selection must not read Orra state; add the assertion + fix any coupling | **#1180** | M | hardening (Io non-regression) | **CLOSED ✅ 2026-08-14** — Io non-regression + `orra-io-contamination` red polarity landed in the same spec |
| Reconcile the #863 harness surface with the served lane — additive adapter mapping `kind: "orra-recognition"` ↔ `orraRuntimeLane`'s `lit`/`spared` so both stay honest; served lane is authoritative | **#1181** | S | reconciliation (1-in-4 harness) | **CLOSED 2026-08-14** (filed + closed same day; P2, cuttable — scope-cut for the 08-22 gate; deferred) |

**Cap state (2026-08-14, retired-block provenance):** the 3/3 open-issue cap
FREED when #1174 + #1175 merged, then all remaining M-ORRA-E1 stories closed
same-day (#1173 done-gate closed with landed assertions; #1180 Io non-regression
closed via the same spec; #1181 reconciliation scope-cut). Open work remaining
for the RETIRED M-ORRA-E1 is exactly ZERO stories. The active gate is
M-CONTINUE-E1 above — not this map.

**Integration-first note:** the done-gate e2e (#1173) was filed FIRST and its
assertions LANDED in `aftersign/e2e/flagship-surface-contract.spec.ts` — the
`light-vigil`/`spare-vigil` beat loop, the three red modes including
`orra-io-contamination`, and the Io non-regression check. The gate drove the
deployed page, not the jsdom harness. Per Mara's 2026-08-14 correction, the
served lane (`orraRuntimeLane.ts` @ 2026-07-28) was never unwired; this epic
added the served-page e2e that pinned the three #863 red modes to it. #863
remains the harness twin (closed); this map spent only served-page hardening —
the harness ration (1-in-4) is untouched. Recognition-depth maintenance capital
banked; not the demo gate (see M-CONTINUE above).

---

## Drift — open issues serving NO active epic

As of 2026-08-14 (retired-block provenance), the open `agent-filed` backlog is
**EMPTY** — all five M-ORRA-E1 stories resolved (#1174/#1175 merged;
#1173/#1180 closed with landed served-page assertions in
`flagship-surface-contract.spec.ts`; #1181 scope-cut). There was NO drift to
dispose this cycle because there were no open issues at all. The live drift
picture is now the M-CONTINUE Drift section above; this paragraph is retained
only to complete the retired block's provenance record.

The M-WIRE-cycle drift set (#1089 perf-preflight, #1071 gate-marker tooling,
#1065 CI-log ergonomics, #1053 README, #1051 architecture-README, #1081 e2e
input-latency) no longer appeared in the open backlog — disposed since the
prior cycle.

**#1165**, flagged by the previous planning chunk as likely drift, was not
present in the current open backlog (no open issues at all) — already closed
or never filed; nothing to dispose.

_Prior-cycle drift resolved: #976/#977/#978/#727 (M-WIRE cycle);
#615/#622/#454/#634 (earlier). M3/#863 was NOT drift — it was the harness twin
of the (then-active, now-retired) M-ORRA-E1._

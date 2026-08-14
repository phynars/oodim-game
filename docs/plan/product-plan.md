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
CLOSED and green — green in the CONTRACT HARNESS
(`orraIndependentRecognition.integration.test.ts`, jsdom
`sampleAftersignOrraMemoryBeat`). Under the amended Definition of Done that
recognition was **stored spec-capital, not shipped value** — a player at
game.oodim.com/aftersign could not yet see or feel any of it. As of 2026-08-14
the served-entry consumer IS landed (`aftersign/main.js:22-28` imports
`orraRuntimeLane.ts`; wired at `:144-147` (`selectOrraRecognitionLine`),
`:211-215` (state shape), `:454-459` (persist), `:730-740` (comment on the two
memory-change sites — the `orraAction` mint branch in `handleChoice` and the
return-to-orra branch)). The gap that REMAINS is player-facing: no DOM gesture
on the served page to trigger `light-vigil` / `spare-vigil`, and zero `orra`
coverage in `aftersign/e2e/flagship-surface-contract.spec.ts` — the module is
wired but the beat is not yet playable or guarded end to end.

M1, M2, and M3 were all declared DONE against contract tests, not the deployed
surface. That is precisely the failure the Founder measured (268 commits, 45
touching the served page, ZERO contract modules imported by it — at that time).
These milestones are NOT re-opened, but their "DONE" is downgraded to
**harness-green**: the invariants are guarded; the player experience is not yet
wired end to end. The active milestone is now the one that closes that gap for
Orra specifically.

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

**Deadline: 2026-08-22 — 8 days remaining** (unchanged public demo date; see
docs/flagship/BRIEF.md "The deadline"). M-WIRE shipped early, so this milestone
inherits the same date. Per the deadline rule: cut scope before slipping. If 8
days is tight, ship ONE branch (either `light-vigil` OR `spare-vigil`), not
both — the falsifiable outcome is ONE second character remembering ONE
deliberate action on the served page.

**Promoted from M4 on 2026-08-14** when M-WIRE closed early: the July contracts
now have live consumers on `aftersign/main.js` and a green served lane guards
them. The Orra recognition module is ALSO already wired on the served entry
(`aftersign/main.js:22-28` imports `orraRuntimeLane.ts`; wired at `:144-147`,
`:211-215`, `:454-459`, `:730-740`) — but the beat is NOT yet playable, because
no DOM gesture on `aftersign/index.html` reaches the mint site and no served
e2e guards it. This milestone converts the wired-but-unreachable module into
player-visible value: expose the gesture, prove the beat end to end.

**Observable outcome (falsifiable on the DEPLOYED page):** A returning visitor
who already has a relationship with Io — has completed the M-WIRE packet beat
and heard Io recognize them next session — opens game.oodim.com/aftersign on a
phone and meets a DIFFERENT named character in the same slice: Saint Orra, the
living sign over the old pharmacy. They perform one deliberate action toward
Orra: `light-vigil` (light the sign, remembered as `lit`) OR `spare-vigil`
(pass the sign untouched, remembered as `spared`) — the two actions
`orraRuntimeLane.ts:13-14` maps to memory outcomes. They leave, and return.
On return Orra speaks a line that references *that* prior action — served by
wired page code, not a jsdom test. Io's own recognition is UNTOUCHED: the same
returning player still hears Io's correct M-WIRE returning-session line. A
control player who never engaged Orra hears Orra's first-contact line, visibly
distinct from the recognition line.

**Why this is the next-smallest outcome:** M-WIRE proved ONE character (Io)
remembers on the served page. The concept's Act II turns on a SECOND
remembering character (Saint Orra) with her OWN memory of the player. M-ORRA
proves the mechanic generalizes to a second independent memory-holder on the
DEPLOYED surface — the smallest honest step toward "a world whose people know
your name" — WITHOUT yet introducing a memory graph, cross-NPC memory sharing,
or branching episodes (all M5+).

**Definition of done (falsifiable, served-page):**
- On a phone at game.oodim.com/aftersign: complete the M-WIRE Io beat, meet
  Saint Orra on the served page, perform the Orra action (`light-vigil` OR
  `spare-vigil`), reload → Orra speaks a line that references that specific
  action (memory outcome `lit` or `spared`). The line is served by wired page
  code (`aftersign/main.js` already imports Orra's recognition module — done;
  the remaining wiring is the DOM gesture that reaches the mint site), not a
  jsdom harness.
- The SAME returning player still hears Io's correct M-WIRE returning-session
  line — Orra's memory does not regress or contaminate Io's.
- A control player who never interacts with Orra hears Orra's first-contact
  line (`ORRA_FIRST_CONTACT_LINE_ID`), NOT a recognition line.
- The epic's integration e2e DRIVES THE DEPLOYED PAGE and proves the
  `light-vigil` / `spare-vigil` branch for Orra AND the Io-parallel
  recognition, and turns RED when: Orra's memory is dropped, the wrong Orra
  line is served, OR the presence of Orra's memory perturbs Io's line.
- No `harness-only`-labelled PR closes this milestone: the gate is the served
  surface (harness-only rationed to 1-in-4 per the amendment).

**LoE budget:** ~1 epic (E1: expose the Orra gesture on the served page and
prove the second independent NPC memory end to end). The `main.js` consumer of
`orraRuntimeLane.ts` is already landed (see status below), so the remaining
work is a DOM gesture surface plus a served-page e2e branch. A memory *graph*,
cross-NPC memory (Orra referencing an Io beat), Niko / Maud / the Child, and
branching episodes remain OUT — M5+.

---

## Active milestone (M-ORRA) — epics

### E1 (ACTIVE) — expose Saint Orra's gesture on the served page and guard the beat end to end

**Acceptance criteria:** on the deployed surface at game.oodim.com/aftersign, a
returning player who already completed the M-WIRE Io beat meets Saint Orra,
performs the `light-vigil` OR `spare-vigil` action, and on return hears Orra's
correct action-specific line (memory outcome `lit` or `spared`, per
`aftersign/src/orraRuntimeLane.ts:13-14`). A single integration e2e drives
`game.oodim.com/aftersign` end to end (M-WIRE Io beat complete → meet Orra →
`light-vigil` OR `spare-vigil` → reload → correct Orra line + unchanged Io
line) and asserts each wired beat is FELT on the served page. The epic is DONE
when that lane is green on main — not when individual wiring PRs merge.

**Status:** just opened (2026-08-14). Starting state — corrected against the
served entry, not the wrong path:

- **Module consumer: ✅ LANDED.** `aftersign/main.js:22-28` imports
  `orraRuntimeLane.ts` (`actionForOrraChoice`, `buildOrraRecognitionMemoryFact`,
  `lineCopyForOrraLineId`, `ORRA_FIRST_CONTACT_LINE_ID`,
  `selectOrraRecognitionLine`). Wired at `:144-147` (`selectOrraRecognitionLine`
  on stored memory), `:211-215` (state shape `npcs.orra.{memory,lastLine,
  lastLineId}`), `:454-459` (persist), `:730-740` (comment documenting the two
  mint sites — the `orraAction` mint branch in `handleChoice` and the
  return-to-orra branch), `:783-790` (`window.__game.npcs.orra` publish). The
  earlier PR revision's "ZERO consumers in `apps/web/**/main.js`" claim was
  grep'ing the wrong tree — the served entry is repo-root `aftersign/main.js`,
  and it already consumes the module. Story #1 as previously written is DONE.
- **DOM gesture: ❌ NOT LANDED.** `aftersign/index.html` has no button for
  `light-vigil` or `spare-vigil`, and `aftersign/main.js` contains no literal
  for either action string — the wired mint site in `handleChoice` has no
  served-page input reaching it.
- **Served-page e2e coverage: ❌ ABSENT.** `aftersign/e2e/flagship-surface-contract.spec.ts`
  has zero `orra` matches. The Orra branch has no served-lane guard.
- **Harness (reference only):** #863's `orraIndependentRecognition.integration.test.ts`
  (jsdom `sampleAftersignOrraMemoryBeat`) is green. Per CONSUMER RULE the
  harness-only ration is untouched — the remaining work is entirely
  served-page.

Sequencing follows M-WIRE's playbook: expose the gesture on the deployed page
first (so the wired mint site becomes reachable), then extend the served-page
e2e to guard `light-vigil` / `spare-vigil` / no-engagement.

**Reference integration story:** M-WIRE-EINT's #1113 (closed 2026-08-11)
established the pattern — a single served-page e2e drives the DEPLOYED surface
end to end and is the epic's done-gate. M-ORRA-E1 extends the same
`aftersign/e2e/flagship-surface-contract.spec.ts` lane with the Orra branch
rather than authoring a parallel harness.

---

## Story map (M-ORRA-E1)

The corrected sequence — story #1 from the prior revision is dropped because
the `main.js` consumer is already landed; the two real gaps go first:

| # | Story | Size | Role |
|---|-------|------|------|
| 1 | Add the served-page Orra gesture surface on `aftersign/index.html` + wire `light-vigil` / `spare-vigil` handlers in `aftersign/main.js` to the existing `orraAction` mint site (`actionForOrraChoice` → `buildOrraRecognitionMemoryFact`) | M | consumer (input surface) |
| 2 | Extend `aftersign/e2e/flagship-surface-contract.spec.ts` with the served-page Orra branch — `light-vigil` → reload → `lit` line; `spare-vigil` → reload → `spared` line; no-engagement → reload → `ORRA_FIRST_CONTACT_LINE_ID` — AND hold Io's M-WIRE line invariant across all three | S/M | integration done-gate |

**Integration-first note:** M-ORRA-E1 does NOT author a new harness — the
harness for Orra recognition exists (#863) AND the served-entry module consumer
already landed (`aftersign/main.js:22-28`). The remaining work is entirely
served-page: expose the `light-vigil` / `spare-vigil` gesture on the deployed
page so the already-wired mint site is reachable, and extend the served-page
e2e to guard the branch. That mirrors M-WIRE-EINT's shape once its consumers
were all landed — only the last mile remains.

---

## Drift — open issues serving NO active epic

These are NOT closed here (operator/human disposes). Named so they don't masquerade as M-ORRA-E1 work:

- **#1089** — [`type:bug` P2, infra] perf-budget e2e specs need a runner-speed
  calibration preflight; slow SwiftShader draws cause ~50% false RED. This is
  test-INFRASTRUCTURE reliability, not a served-page beat — but it is adjacent
  to the served-page e2e lane M-ORRA-E1 extends (false REDs on that lane can
  mask/mimic the epic's real signal, same shape as the risk that hit M-WIRE's
  now-closed #1113). Keep OUT of the story map (it wires no consumer), but flag
  it to whoever extends the served-page e2e with the Orra branch so a flaky perf
  preflight isn't mistaken for an unwired beat. Operator disposes.
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
  latency. Sharpens the feel-envelope assertion on the served-page e2e lane
  M-ORRA-E1 extends — a test-quality refinement, not itself a served-page beat.
  Fold into an M-ORRA-E1 e2e story if convenient, else operator disposes.

_Retired prior-cycle drift: #976/#977/#978 and #727 no longer appear in the open
`agent-filed` backlog (disposed since the last cycle)._

_M3 (Saint Orra) is no longer deferred: its served-page wiring was promoted
from M4 to the active milestone M-ORRA on 2026-08-14 when M-WIRE shipped early
(#1113 closed 2026-08-11, main green @ e9644cc). M3's harness-green integration
(#863) is the starting capital for M-ORRA-E1 above. Prior-cycle drift
(#615/#622/#454/#634) resolved. Current drift is #976/#977/#978 + #727 above._

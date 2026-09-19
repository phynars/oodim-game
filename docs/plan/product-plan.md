# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world whose memory changes what they can do next. Ship the smallest complete replayable loop on https://game.oodim.com/aftersign before adding characters, systems, or polish. Merged components are not acceptance: the player must complete the loop and identify a mechanically different next-round choice.

Planning checkpoint: **2026-09-19, cycle chunk 2**. Product authority: `docs/flagship/BRIEF.md`. M2 / M2-E1 are planning aliases for M-LOOP / M-LOOP-E1, not a code-renaming project. Exactly one milestone and one epic are active. This is a plan-only revision; it closes no code issue.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan; not re-certified this cycle.

Definition of done: on the deployed phone surface, visible taps reach the return-tone choice and next-job handoff after recognition, asserting each visible dialogue transition. PLAYTEST: historical #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`, as recorded in the previous plan; not rerun this cycle.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Only regressions blocking M2's playable path enter current scope.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance incomplete**. Historical alias: M-LOOP.

**Days remaining: -14 as of 2026-09-19 (fourteen days overdue).** September 5 is the retained planning target, not a newly verified founder commitment. No founder-authorized replacement has been verified. The prior plan records a request for founder confirmation; do not silently move the date or repeat that request without checking for a response in the brief.

Definition of done:

1. On the deployed `/aftersign/` surface, prepare two distinct durable memory records. Play **each record through two consecutive complete rounds**: job → real route traversal and risk choice → delivery/answer → return/payback. No reseeding between the two rounds of a record.
2. The two records produce different AVAILABLE mechanical actions: job identity, price, route availability, or enabled action identity. Different dialogue, labels, cosmetic attributes, or feel stamps alone score zero. The differing action must be usable by visible tap.
3. PLAYTEST: #1819 is the open integration gate. Use 390×844 touch/mobile contexts, visible enabled pointer taps, and assertions for every visible dialogue change, from boot through the final beat of round two for both records. `window.__game` is assert-only; no harness input, evaluated DOM clicks, forced clicks, or hidden controls. Save setup before play is allowed.
4. Recognition, tone response, and next-job handoff remain reachable. Repeat loading the same starting record produces the same available mechanical actions.
5. Record deployed URL/revision, acceptance run URL, executed/non-skipped test counts, and trace/video artifacts. Record a stranger's unprompted answer to “what will you do differently next round?” with date/revision in the public devlog. Link both forms of evidence here before DONE.

LoE budget: one epic; **3–7 mapped execution stories total, each S/M after reconciliation**. Current open #1818 and #1819 are labeled L, so this budget is NOT yet satisfied. Preserve their identities while inspecting exact execution scope; do not create duplicate integration issues to hide the sizing problem. No new harness-only story is authorized. Reuse completed building blocks.

Time-first ordering: prove the shortest playable two-record/two-round route first, fix only observed blockers, then collect deployed and human replay evidence. Cut copy/feel polish, additional payback channels, NPCs/maps, and unrelated depth before slipping the date. Do not cut mechanical divergence or the second completed round.

## Active milestone's epics

### M2-E1 — A phone player completes the deployed loop by taps and acts on memory-driven payback

Status: **ACTIVE — integration identity reconciled; execution sizing and evidence pending**.

Days remaining: -14 as of 2026-09-19.

Acceptance criteria: all M2 done criteria pass on the served phone page. Both durable records complete two rounds, mechanically different controls can actually be selected, every visible dialogue transition is asserted, and a human replay answer and deployed artifacts are linked.

LoE: 3–7 S/M execution stories; provisional map below has three existing open identities plus one unfiled evidence slot. The two L-labeled issues require scope reconciliation before the map is final. Historical completed building blocks are dependencies, not new execution stories.

**INTEGRATION story: #1819 (open).** Its body explicitly requires two durable records, two complete rounds per record, phone viewport, rendered-controls-only actions, action-level divergence, and the standing playtest suite. It currently depends on #1818. Keep this as the done-gate; no duplicate integration story is needed. Additional plan requirements are explicit visible-dialogue assertions and deployed/human evidence, not claims that the issue already implements them.

**Dependency reconciliation:** #1818 asks for deterministic served action divergence; #1827 claims existing wiring and proposes a two-save served DOM assertion. Those claims do not establish that #1818 is complete. #1827 is a bounded diagnostic/component check consumed by #1819, not a substitute for two played rounds. Inspect the renderer and sibling played spec before authorizing any new implementation story. Attribute inequality alone must not be accepted as mechanical divergence.

The epic is done when its integration and replay evidence pass, not when its component issues close.

## Story map — M2-E1

Days remaining: -14 as of 2026-09-19. **Provisional: no new issues filed in chunk 2.** Ordering follows the overdue playable outcome rather than component elegance.

| Order | Player outcome | Issue | LoE | Disposition / integration consumer |
| --- | --- | --- | --- | --- |
| 0 | A phone player completes two rounds from each durable record and uses memory-specific available actions | #1819 | L currently; S/M scope unresolved | OPEN INTEGRATION + PLAYTEST identity. Preserve before any implementation filing. Explicit dependency on #1818. Inspect existing suite to bound continuation work instead of duplicating it. |
| 1 | A phone player sees deterministic, mechanically different available job/price/route actions across durable records | #1827 | M | OPEN served-page two-save DOM check. Feeds #1818 diagnosis and #1819 acceptance. Reuse, do not re-file. Different decorative attributes or copy alone cannot close M2. |
| 2 | A phone player can select and use the memory-specific action on the actual page | #1818 | L currently; repair scope unresolved | OPEN runtime requirement. #1827 reports wiring already exists; that report needs direct inspection. Authorize only a demonstrated S/M player-surface gap, not a new divergence subsystem. |
| 3 | A stranger completes the deployed replay and explains a different next-round action | Existing issue/evidence not yet located | S proposed | Evidence closeout consumed by #1819. Locate existing deployed artifacts and human replay before filing; uninspected does not mean absent. |

Historical reuse, inherited from the previous plan: #1535 and #1551 were recorded CLOSED building blocks, with #1555 merged August 31. #1552 was recorded as partial PLAYTEST coverage stopping at the second offer. #1370 was an earlier integration identity. Read historical issues only if needed to avoid duplicating specific remaining execution; none is a reason to file a competing gate to open #1819.

Every newly filed story must begin with these lines:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -14 (fourteen days overdue), as of 2026-09-19
```

Before filing: refresh open issues, verify affected paths and symbols, size by file blast radius (S one file; M two–three files), name the served page and taps-only acceptance, and name #1819 as integration consumer. Existing stories must be mapped rather than re-filed. Do not count unconsumed harness work as player progress.

## Evidence ledger — 2026-09-19, chunk 2

### Directly checked this chunk

- Read #1818, #1827, and #1819: all OPEN. #1818 and #1819 carry L labels; #1827 carries M. #1819 already supplies the integration-first identity and depends on #1818.
- #1827 reports that `aftersign/main.js` already consumes divergence copy and asks for a served DOM assertion. Its report is not direct renderer verification. Its two-boots scope does not prove #1819's two-rounds-per-record scope.
- Read `aftersign/e2e/aftersign-job-take-feel.playtest.spec.ts`: it visits `/aftersign/?slot=...`, uses 390×844 touch/mobile, asserts a visible/enabled safe-delivery offer and its action/feel stamps, taps the offer, and asserts its armed state. This is a served single-offer check, not two-record/two-round acceptance. It provides a reusable visible-tap pattern, not milestone completion evidence.
- Refreshed open board: seven issues returned, #1827, #1825, #1819, #1818, #1812, #1808, #1788. No newly filed stories this chunk.

### Trusted previous-chunk findings

- The brief requires two durable records, each played through two consecutive rounds using visible taps.
- PR #1829 merged September 18. A merge alone does not establish M2 acceptance; the deployed run and human replay were not verified.

### Still unverified

Direct renderer behavior; sibling played-spec coverage; exact S/M execution boundaries for #1818/#1819; current deployed acceptance artifacts and non-skipped results; human replay evidence; founder-authorized replacement date; historical issue dispositions only where needed for deduplication. This cycle is not complete, and no CI-green or milestone-DONE claim is made.

## Drift and operator disposition

Title-level triage from the fresh open board; bodies not inspected this chunk:

- **#1825 — no active epic mapped:** pipeline decomposition refactor, not the player loop. Operator work outside M2 unless an actual acceptance-delivery blocker is demonstrated.
- **#1808 — no active epic mapped:** recovery of stuck press-juice PR gates. Keep outside the overdue loop unless those exact PRs are necessary to play it.
- **#1812 — no active epic mapped:** Io return dialogue wiring/depth. Dialogue-only divergence cannot satisfy M2; promote only a demonstrated missing visible-dialogue transition blocker.
- **#1788 — blocker assessment pending, not confirmed drift:** disabled reload-beat regression coverage may protect durable replay. Inspect before mapping or excluding it.

Do not close any of these issues as a planning action.

## Next-chunk handoff

1. EXACT next action: read `aftersign/e2e/job-offers-played.spec.ts`, then the relevant served renderer region in `aftersign/main.js`; avoid inferring the renderer from issue prose.
2. Preserve #1819 as open INTEGRATION + PLAYTEST. It already covers two records × two rounds; do not duplicate it.
3. Reconcile #1827's two-save DOM probe with #1818's runtime requirement; attribute/copy differences are not necessarily different available actions.
4. Bound remaining execution to S/M by verified touched files; existing #1818/#1819 are L, so the final 3–7-story map is not yet ready.
5. Reuse historical #1370/#1552 only where a specific duplication question remains.
6. Locate deployed run artifacts and human replay evidence before creating an evidence story.
7. Inspect #1788 only to decide whether it blocks the durable two-round path; keep title-level drift classifications provisional.
8. Refresh the board before filing. Existing stories get mapped, not re-filed; any new story starts with the milestone/epic/date/days lines above.
9. Retain September 5 and -14 days remaining unless the brief verifies a founder-authorized replacement.
10. End META-DONE only after the S/M stories and evidence ownership are filed/mapped and the plan is current; otherwise hand off the remaining concrete step.

# AFTERSIGN — product plan

## Vision

A phone player takes a job, makes a consequential route choice, delivers, and returns to a world whose available actions change because of that history. Io's recognition makes memory legible; a changed job, price, or route makes it playable. Ship the smallest complete replayable loop before adding characters, payback channels, or feel polish.

## Milestones

### M1 — a phone player continues beyond Io's recognition into a tone answer and the next job

Deadline: 2026-08-22

**Status:** historical completion recorded by the previous plan; not re-validated in this planning cycle. This consolidates the prior M-CONTINUE outcome, not a new completion claim. Earlier recognition and wiring milestones are historical foundations, not parallel active work; their detailed records remain in git history.

**Definition of done:** on the deployed AFTERSIGN page, a phone visitor reaches recognition, taps a return tone, sees Io's answer, and taps onward to the next job. Each dialogue change is asserted on visible elements; player actions never use `window.__game.input.*`.

**LoE budget:** historical allocation: one epic. No new allocation this cycle.

**PLAYTEST story:** historical #1216, referenced by the previous plan as the continuation acceptance gate. Its run evidence has not been rechecked this cycle.

### M2 / M-LOOP — a phone player completes two rounds and can explain a different next action because memory changed the available actions

Deadline: 2026-09-05

**Status:** ACTIVE — the ONLY active milestone.

**Time remaining as of 2026-09-11: -6 days (six days overdue).** September 5 is the inherited spec-writer target, not a founder-confirmed deadline. The preceding planning chunk confirmed that the brief's loop amendment supplies no replacement date. Keep this target until the founder explicitly confirms or replaces it; do not convert lateness into a silent extension.

**Definition of done:**
- At `https://game.oodim.com/aftersign/`, a phone visitor can take a job, traverse its route with one risk choice, deliver, answer, and return. A recorded fact changes a later round's actionable offer, route, or price. Dialogue-only differences do not qualify.
- A deployed-page phone-viewport divergence acceptance spec starts from two divergent memory records, plays a complete round from EACH, and proves different visible, tappable action elements. Save setup is a fixture, not a substitute for playing the rounds.
- ONE continuous phone PLAYTEST plays boot through TWO COMPLETED consecutive rounds, asserting every visible dialogue change and the changed action set after round one. Reaching round two's offer is not completing round two.
- Actions use pointer taps on visible served elements. `window.__game` is assertion-only. Readiness and snapshots may be read, never used to cause a player action.
- Both acceptance journeys run without skips against a recorded deployment revision. Store run URL, date, target URL, commit/deployment identity, and trace/video evidence; merge status alone is not acceptance.
- Record a stranger's actual answer to “what will you do differently next round?” with session date, tested deployment, observed choices, and evidence link. Do not infer this human replay result from CI.

**LoE budget:** one epic; remaining work capped at three to seven S/M stories, with a provisional ceiling of five M-sized stories. No new subsystem. Split cross-cutting work before filing, and cut optional polish rather than weakening the two-round/divergence floor.

**PLAYTEST story:** #1552 is closed (September 1, confirmed by preceding chunk), but its inspected spec stops at round two's offer. A complete-two-round follow-up must be part of the integration gate below; no milestone DONE claim is authorized.

## Active milestone's epics

### M2-E1 / M-LOOP-E1 — a phone player can use memory-dependent jobs and complete the resulting replay loop

**Status:** ACTIVE — the ONLY active epic; acceptance reconciliation incomplete.

**Acceptance:** a player can complete the M2 journeys on the deployed page by tapping visible controls, observe changed actionable elements between memory histories, see each dialogue update, and choose a meaningful different action next round. The epic is done only when its integration gate and human replay evidence satisfy the M2 definition of done, not when component PRs merge.

**LoE:** three to seven S/M stories within M2's five-M provisional ceiling. Prefer extending existing served acceptance over adding parallel harnesses. Harness-only stories are capped at one in four; none is currently proposed.

**INTEGRATION story — must exist before any implementation stories are filed:** a phone player can finish two rounds and play a full round from each divergent save on the deployed surface. Reuse a matching open gate if one exists; otherwise file a bounded M-sized acceptance repair against the existing played specs. Its acceptance includes per-beat visible dialogue assertions, taps-only actions, element-level divergence, no skips, deployment/run evidence, and a link to the human replay result. Any missing served behavior gets a separate S/M consumer story, with the gate depending on it; do not bury cross-cutting implementation inside the gate.

**Integration issue:** not yet reconciled/filed. Closed #1552 is partial historical evidence, not an open gate. The next chunk must search the current board before creating a follow-up. No new implementation stories were filed in chunk 2.

### Deadline-first scope order

1. Establish the integration gate and reproduce the missing last beat on the deployed phone surface.
2. Repair only confirmed blockers to a complete round, risk consequence, and second-round completion. Reuse existing job divergence; no additional payback channel merely to fill the story count.
3. Capture complete taps-only acceptance and human replay evidence on the same deployment.
4. Defer reticle/feel polish, extra NPCs, additional economies, and parallel test harnesses unless an observed tap blocker prevents the required journey.

## Story map — M2-E1 (reconciliation draft)

**Time remaining: -6 days as of 2026-09-11.** Rows without an issue number are candidates, not filed work. Finish reconciliation before deciding which gaps need code.

| Order | Player outcome | Issue / size | Status and integration relationship |
| --- | --- | --- | --- |
| 1 | A phone player completes two rounds and a complete round from each divergent save, with visible dialogue and changed actions proven on the deployed page | Integration follow-up: unfiled / M target | FIRST filing after deduplication. Extend existing acceptance rather than create an unused harness. Refs #1552; its current spec only reaches the second offer. |
| 2 | A player receives memory-dependent actionable job choices | #1535 / historical M | Previous plan says closed; issue body and actual coverage still need reconciliation. Do not re-file on that historical assertion alone. |
| 3 | A player can read the offered route/risk and make an informed choice | #1551 / historical M | Previous chunk linked landed #1555 to this work; current issue criteria still need checking. Two inspected specs assert risk-bearing offer labels; that does not prove route traversal or recorded risk payback. |
| 4 | A player can complete the second job, deliver, answer, and return without a test-only action | Follow-up only if a served blocker is reproduced / S or M | Current #1552 spec does not exercise this outcome. First extend/play acceptance; do not assume missing test coverage means missing runtime behavior. Consumer story must be named by the integration issue if a fix is needed. |
| 5 | A stranger can explain and demonstrate what they would do differently next round | Evidence/replay follow-up only if no record exists / S target | Locate existing human evidence first. Record observed response and deployment; the integration gate consumes this result. Do not manufacture an autonomous code task for a human-only session. |

Required header for any newly filed story:

```text
Milestone: M2 — a phone player completes two rounds with memory-dependent available actions
Epic: M2-E1 — a phone player completes the deployed replay loop by visible taps and sees actionable divergence
Deadline: 2026-09-05
Days remaining: -6 as of 2026-09-11 (six days overdue; founder confirmation pending)
```

## Evidence checkpoint — 2026-09-11, cycle chunk 2

Inspected directly at session snapshot `a3358f976871`:

- `aftersign/e2e/m-loop-e1-two-round-playtest.spec.ts`: sets 390×844, touch/mobile enabled; player actions use `.tap()`; `window.__game` is only read for readiness and offer assertions. No skip declaration in this file. It compares first-offer and returning-offer element IDs and labels, but ENDS after asserting the second offer. It does not take or complete a second job. It asserts one recognition line plus offer labels; beat visibility checks do not assert every dialogue change. Its relative `page.goto` does not establish which deployment a run targets.
- `aftersign/e2e/job-offers-played.spec.ts`: plays one fresh slot through a return to changed offers. Actions use `.click()` on DOM controls, not game-input mutation. This file neither seeds two independent divergent saves nor completes a round from each; it ends at returning offers. It declares no phone viewport locally and no skips locally; project configuration and run evidence remain uninspected. Its name/comment is not evidence of phone tap configuration.
- Open #1721 requests target-loss prompt/reticle wiring. Open #1727 requests a display-only reticle stop intercepting taps. These are issue-author descriptions, not newly verified runtime defects.
- Preceding chunk confirmed #1726 merged September 11. This does not establish deployed acceptance or automatically resolve #1721. No issue was closed in this chunk.

**Not yet verified:** sibling divergence spec contents or conditional skips; active CI inclusion and deployment target; recent acceptance run artifacts; #1551/#1535 criteria; risk-record-to-action causality; human replay evidence. No current green/deployed/DONE claim is made.

## Drift and conditional maintenance

- **#1721 — no active epic assignment:** target-loss feedback polish does not establish two completed rounds or memory-dependent actions. Reconcile its requested wiring against merged #1726 before the operator disposes it; do not close it merely from a related merge.
- **#1727 — conditional journey blocker, not yet assigned:** tap interception could block the required phone journey, but that obstruction has not been reproduced here. If it blocks visible acceptance controls, map the existing issue to M2-E1 rather than duplicate it; otherwise defer as maintenance outside the epic.
- Older drift lists are removed from the current board view because they were historical, contradictory records. The preceding chunk's open-board check and these two issue reads are the current evidence; refresh the board before filing.

## Next planning chunk

Exact next action: read #1551, then #1535, to reconcile their acceptance and closing changes. Inspect the remaining divergence spec and locate human replay/run evidence with one targeted repo search. Refresh open issues; reuse/file the integration gate FIRST. Then file only verified S/M gaps and replace candidate rows with issue numbers. Founder deadline confirmation must be explicitly requested without moving September 5. Complete story mapping in the remaining cycle chunks; this checkpoint is not META-DONE.

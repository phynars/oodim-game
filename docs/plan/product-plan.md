# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world that remembers it mechanically: what the player can do next changes, not merely what Io says. Build the smallest complete, replayable loop on https://game.oodim.com/aftersign before adding characters, systems, or polish. Memory is progression; merged components are not milestone acceptance.

Planning checkpoint: **2026-09-11**. Source of product authority: `docs/flagship/BRIEF.md`, especially the founder's August 22 amendment. Exactly one active milestone and one active epic. Current plan identifiers **M2 / M2-E1** refer to historical **M-LOOP / M-LOOP-E1**; this is a planning alias, not a code-renaming project.

**Scope of this revision (Refs #1731, not Closes):** this change is plan-only — a `docs/plan:` PR, not a `fix:`. It restates the M-LOOP done-gate in the founder's verbatim words and tightens the epic's story budget. It does NOT repair `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts`; the taps-only two-round integration spec called for by #1731 remains open and must land in a separate code PR before M2-E1 can be closed.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan, not re-certified this cycle. This is the former M-CONTINUE outcome, not a new declaration of DONE. Earlier recognition, Orra, and wiring efforts are supporting history, not competing active milestones.

Definition of done: a player reaches the return-tone choice and next-job handoff after recognition on the deployed phone surface through visible taps; each visible dialogue transition is asserted, and existing recognition remains reachable. The previous plan identifies #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts` as its PLAYTEST evidence. That historical evidence has not been rerun in this planning cycle.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Regressions that block M2 belong to M2's playable path, not a reopened recognition-depth roadmap.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance incomplete**. Historical alias: M-LOOP.

**Days remaining: -6 as of 2026-09-11 (six days overdue).** September 5 is the existing spec-writer planning target, not a founder-confirmed deadline. The brief gives no replacement date for M-LOOP. **Founder decision requested: confirm September 5 as the missed target or explicitly authorize a replacement date.** Until then, retain it; do not erase the miss by rolling the date forward.

Founder bar, verbatim from the August 22 amendment:

> **M-LOOP metric: divergence.** Two save-states with different memory
> records MUST produce different AVAILABLE ACTIONS on the served page —
> different job offers, prices, or open routes; dialogue-only differences
> score zero.
>
> **Integration proof (the milestone's done-gate spec):** a taps-only
> phone-viewport spec seeds two saves with different memory records,
> plays one round from each, and asserts the two runs' rendered pages
> offered DIFFERENT tappable actions (element-level, not text-level). Plus
> the standing playtest spec extended to complete TWO consecutive rounds.
>
> **Definition of DONE for the milestone:** a stranger finishes round one
> and can answer "what will you do differently next round?" — the retell
> bar upgraded to a replay bar. (Human playtest evidence; not CI-able —
> recorded in the devlog per run.)

Definition of done:

1. On the deployed page, two divergent memory saves each support a complete job → real route traversal with one risk choice → delivery/answer → return/payback round. Different available actions are proved at element/action identity or enabled-state level, not by labels or dialogue alone.
2. A **single continuous phone PLAYTEST** goes from cold boot through **two completed rounds**, tapping only visible enabled elements and asserting every visible dialogue change. Round two's offer is an intermediate checkpoint, not the finish. The run asserts memory recording and a changed available action after round one; no reseed between rounds.
3. Use 390×844 with touch/mobile enabled. `window.__game` is assert-only. No game action may be caused by harness input, evaluated DOM clicks, forced clicks, or hidden controls. Initial divergent-save setup is allowed before play.
4. Retain reachable recognition, tone response, and next-job handoff. A player can select the mechanically differing action, not merely inspect it.
5. Attach deployed revision, deployed URL, run URL, executed test counts, and trace/video artifacts for the non-skipped acceptance run. Record a stranger's unprompted replay answer with date/revision in the public devlog and link it here before marking DONE.

LoE budget: **one epic, four mapped stories**: two previously closed M building blocks, one existing M partial PLAYTEST, and one S single-file integration repair that consumes and completes the existing work. These sizes describe file blast radius, not a promise of elapsed delivery time. Authorize no speculative new implementation ladder. If the gate exposes a runtime blocker, bound the concrete player-surface repair first.

Scope cuts, in order: copy/feel polish, additional payback channels, extra characters, and any depth beyond two proved rounds. Do not lower the mechanical-divergence bar to declare an overdue milestone DONE.

## Active milestone's epics

### M2-E1 — A phone player can complete the deployed loop by taps and act on memory-driven payback

Status: **ACTIVE**; acceptance reconciliation incomplete. Historical alias: M-LOOP-E1. Days remaining: -6 as of 2026-09-11.

Acceptance criteria: the deployed surface supports every M2 round step by visible pointer taps; divergent saved memories produce different **mechanical** choices (element/action identity, not just labels); the same player can complete a second round and see every visible dialogue transition. Recorded human replay and deployed artifacts are required at closeout.

LoE: **one epic, four mapped stories** — two closed M building blocks (#1535, #1551), one existing partial M PLAYTEST (#1552), and the integration gate (#1370). Only S/M single-file continuation repairs are authorized as new work. Existing merged building blocks are reused, not rebuilt.

**INTEGRATION story:** #1370 is the existing done-gate identity explicitly named in `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts`. Its current issue disposition and acceptance scope must be read before deciding reuse versus a narrowly scoped successor. Do not file implementation stories before that reconciliation establishes an open integration gate. The spec alone does not satisfy the gate; a skipped-lane run, a labels-only difference, or stopping at the second offer does not close it.

**Integration success is the epic's done signal**, not a count of merged component PRs.

## Story map — M2-E1

Days remaining: -6 (six days overdue), as of 2026-09-11. This map is provisional pending the final planning chunk; no new issues were filed in chunk 3. Ordering is by the shortest path to playable acceptance, not component elegance.

| Order | Player outcome | Issue | LoE | Disposition / dependency |
| --- | --- | --- | --- | --- |
| 0 | A phone player can complete a round from each divergent save and obtain different mechanical actions on the deployed surface | #1370 | M proposed | Existing INTEGRATION identity; issue status/scope unverified. Read FIRST next chunk; reuse or file its successor before any implementation gaps. |
| 1 | A phone player can select a memory-specific job action | #1535 | M | CLOSED 2026-08-29. Its issue criteria cover action IDs, snapshot fields, and canonical input routing; that is not by itself proof of two played rounds. No duplicate contract story. |
| 2 | A phone player can read the offered route and risk across memory branches | #1551 | M | CLOSED 2026-08-31; PR #1555 confirmed merged that day. Issue requires visible route/risk and a cross-branch served assertion. Full closing diff and deployed proof remain unverified here; do not reopen or duplicate on that basis. |
| 3 | A phone player can play continuously from boot through completion of round TWO, seeing each dialogue change | #1552 | M | Existing PLAYTEST story. Prior chunk inspected its spec: it ends at the second offer, so that inspected coverage does not establish two completed rounds. Reconcile issue disposition and integration scope before filing a bounded continuation gap. |
| 4 | A stranger can replay the loop and explain a different next-round action | Not filed | S proposed | Acceptance closeout, not a harness module. Locate existing human replay/deployed artifacts first; if absent, map a served-play evidence story under the integration gate. Do not call absent inspection proof of absent evidence. |

Every newly filed story must begin with:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -6 (six days overdue), as of 2026-09-11
```

Each new story must name the deployed surface, visible-pointer acceptance, precise verified affected files, and the integration consumer. No new unconsumed contract/harness stories are authorized.

## Acceptance reconciliation — 2026-09-11, chunk 3

### Established this chunk

- Read #1551, then #1535. Their CLOSED states do not certify the wider M2 outcome. #1535's stated acceptance is chiefly action-ID/snapshot/handler coverage; #1551 adds visible route/risk coverage. Preserve both as completed building-block issue records rather than filing duplicates.
- PR #1555 is merged (2026-08-31). Its returned discussion reports served route/risk wiring and a human-lane layout repair. The thread is truncated; neither a complete closing diff nor a current successful deployed run was retrieved. No current CI-green claim is made.
- Read `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts`. It selects `test.describe.skip` unless `M_LOOP_E1_IMPL_LANDED === "1"`. Workflow configuration has NOT been inspected here, so whether CI sets that flag remains unknown.
- That spec creates 390×844 contexts with `hasTouch: true` and `isMobile: true`. It plays kind/evasive paths to `io-next-job`, reloads, and compares visible/enabled button rows containing both IDs and labels. A labels-only difference can satisfy the final inequality; the assertion therefore does not independently enforce the stronger mechanical-action bar.
- It does not continue a complete played round after each reload. Its snapshot reads assert tone facts. This is partial acceptance coverage, not evidence that the actual game lacks the required mechanics.
- Fresh open-board query returned only #1727. #1370 and #1721 were not in that result; absence from the open list does not establish why they closed or their acceptance status.

### Trusted prior-chunk findings

- M2 is the sole active milestone; September 5 is six days overdue.
- The inspected #1552 spec ends at the second offer.
- Inspected job-offer coverage is one-slot, first-visit-to-return, not the full two-save/two-round acceptance gate.
- Founder date confirmation has already been requested; do not resend or invent a reply.

### Evidence still required

The #1370 issue body/disposition; #1535's closing changes if needed to settle a specific criterion; actual acceptance-lane workflow settings; deployed run artifacts; recorded human replay; and a deduplicated open integration gate with only verified S/M follow-ups. These are unverified, not presumed missing. This planning cycle is NOT complete.

## Drift and operator disposition

- **#1727 — open:** title reports a display-only aim-reticle overlay stealing taps. No explicit M2-E1 mapping is established by the list result. Hold outside the active story map pending scope inspection; promote it only if it blocks the deployed loop's visible taps. Do not close it as drift and do not duplicate it as a new phone-input repair.
- **#1721 — prior disposition retained pending reconciliation:** absent from the refreshed open board. The prior handoff requested retaining this note but supplied no title or resolution; do not fabricate either or count it as open drift. Read only if its disposition affects the active gate.
- No other open issues were returned by the refreshed board. Older operator issues and retired milestone story lists are not current work authorization.

## Final-chunk handoff

1. Read #1370 FIRST: reconcile the existing integration issue with the inspected conditional spec and M2 acceptance.
2. Resolve an open integration gate before any implementation filing; inspect only the exact files needed to make its scope verifiable and S/M.
3. Check acceptance-lane configuration and locate deployed run/human replay evidence; no green-by-assumption.
4. Reuse #1535/#1551; do not rebuild their contracts. Keep #1552's second-offer stopping point separate from full-round completion.
5. File only verified remaining gaps, 3–7 total mapped stories including reused work; update this map with actual issue numbers.
6. Inspect #1727 only if it can supply an existing player-input repair; preserve #1721's unresolved disposition note.
7. Keep September 5 and -6 days remaining unless founder confirmation actually supplies a new authorized target.
8. End META-DONE only when the integration-first map is actually filed and current; otherwise state the specific blocker.

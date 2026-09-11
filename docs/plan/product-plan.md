# AFTERSIGN — product plan

## Vision

A phone visitor takes a delivery job, makes a consequential choice, leaves, and returns to a world that remembers through the actions it makes available—not just through different dialogue. Ship the smallest playable loop that lets a stranger explain what they will do differently next round; more characters, polish, and isolated contracts do not substitute for that outcome.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone answer and the next job

Deadline: 2026-08-22

**Status:** historical completion recorded by the previous plan; not re-certified in this reconciliation. This compact plan groups the previous recognition/continuation milestones under M1. Historical issue identifiers remain unchanged; M1 here includes the former M-CONTINUE, not only the old July M1.

**Observable outcome / definition of done:** at https://game.oodim.com/aftersign/, a phone player reaches Io's recognition, selects a visible tone response, reads the answer, and reaches the next-job offer. A boot-to-last-beat PLAYTEST uses pointer taps on visible elements and asserts every visible dialogue change; `window.__game` is assert-only.

**LoE budget:** no new allocation; historical one-epic continuation scope. Historical PLAYTEST story: #1216. Prior plan recorded completion on August 22; that record is provenance, not a fresh deployed run result.

### M2 — A phone player completes two delivery rounds and sees memory change the next available action

Deadline: 2026-09-05

**Status: ACTIVE — the sole active milestone.** Historical alias: M-LOOP. **Days remaining: -6 (six days overdue), as of 2026-09-11.** September 5 is the existing spec-writer target, not a founder-confirmed date. Founder confirmation was requested via Telegram in the preceding chunk; no response is established here. Do not silently move the deadline.

**Observable outcome:** a stranger plays two complete rounds on the deployed phone surface. A round includes taking a job, traversing its route with one risk choice, delivering and answering, and seeing the resulting memory affect a subsequent available action. After round one the player can explain what they intend to do differently next round.

**Definition of done:**

- On the deployed page, a taps-only phone-viewport divergence spec starts from two different saved memory records, completes one round from each, and proves a mechanically different available action through visible, enabled elements. Changing only dialogue or button labels is insufficient.
- A continuous boot-to-last-beat PLAYTEST completes TWO rounds, not merely arrival at the second offer. It asserts every visible dialogue transition and the changed action availability after round one.
- One route-risk choice is recorded and has a mechanical consequence in a later round. One payback channel is enough; extra economies and NPCs are out.
- Player actions use pointer taps on visible controls. `window.__game` is assert-only. Save setup may establish initial conditions but may not bypass either played round.
- Acceptance records identify deployed URL, revision, run link/artifacts, phone configuration, and executed/not-skipped lanes. A green local or harness-only run cannot establish deployed acceptance.
- A recorded stranger replay states their answer to “what will you do differently next round?” with the run/date and observed outcome. CI alone cannot satisfy this criterion.

**LoE budget:** one epic; 3–7 S/M mapped stories including integration and PLAYTEST. Cap remaining implementation allocation at two M-sized player-visible repairs until evidence shows a necessary gap. No speculative new subsystem; split any broader repair before authorization. Harness-only stories: at most one in four; currently none authorized.

**Deadline-first scope rule:** finish a rough but playable complete loop and its proof before copy polish, another payback channel, or more recognition depth. Do not lower the two-round or mechanical-divergence bar to declare an overdue milestone done.

## Active milestone's epics

### M2-E1 — A phone player can complete the loop and act on its memory-driven payback

**Status:** ACTIVE; acceptance reconciliation incomplete. Historical alias: M-LOOP-E1. Days remaining: -6 as of 2026-09-11.

**Acceptance criteria:** the deployed surface supports every M2 round step by visible pointer taps; divergent saved memories produce different mechanical choices; the same player can finish a second round and see every dialogue change. The milestone's recorded human replay and deployed artifacts are required at closeout.

**LoE:** one epic, 3–7 S/M stories; remaining repairs capped at two M stories pending inspection. Existing merged building blocks are reused, not rebuilt.

**INTEGRATION story:** #1370 is the existing done-gate identity explicitly named in `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts`. Its current issue disposition and acceptance scope must be read before deciding reuse versus a narrowly scoped successor. Do not file implementation stories before that reconciliation establishes an open integration gate. The old spec alone does not satisfy the gate.

**Integration success is the epic's done signal**, not a count of merged component PRs. A skipped lane, a changed label on the same action, or stopping at an offer cannot count as a completed loop.

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

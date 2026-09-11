# AFTERSIGN — product plan

## Vision

A phone player returns to AFTERSIGN because its characters remember what they did and that memory changes what they can DO next. In one original three.js scene, a delivery for Io involves a route risk, a recorded outcome, and a return with mechanically different opportunities. Recognition supports the story; available actions supply the reason to replay. Ship this small playable loop before adding characters, maps, or more recognition polish.

## Milestones

Planning date: **2026-09-11**. Exactly one milestone and one epic are active.
Numbered headings below retain legacy identifiers so existing issue links remain usable.
This replaces the contradictory historical active headings; prior detail remains in git history.

### M1 / M-CONTINUE — a phone player continues past Io's recognition into a tone choice and the next job

Deadline: 2026-08-22

**Status:** historical predecessor; not active. The previous plan records completion on 2026-08-22. This planning chunk has NOT re-certified its playtest or CI evidence.

**Deadline source:** founder's amendments in `docs/flagship/BRIEF.md`.

**Definition of done:** a player reaches at least two additional beats after recognition on `https://game.oodim.com/aftersign` using visible controls; the tone reply and next-job handoff actually render. Recognition must not regress.

**PLAYTEST story:** historical #1216; the previous plan points to `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`. Require a boot-to-last-beat phone-viewport run using taps only and asserting each visible dialogue change. File and run status remain historical assertions, not newly verified evidence.

**LoE budget:** historical allocation: one epic. No new work authorized; remaining M1 budget is zero. Player-breaking regressions belong in the current journey, not a reopened predecessor.

### M2 / M-LOOP — a phone player completes a delivery and returns to different available actions caused by memory

Deadline: 2026-09-05

**Status: ACTIVE. Days remaining: -6 (6 days overdue as of 2026-09-11).**

**Deadline source:** inherited spec-writer planning target, NOT founder-confirmed. The founder's 2026-08-22 loop amendment sets the outcome but supplies no M-LOOP deadline. Do not silently reset the clock. Founder confirmation is outstanding; next chunk must explicitly request the date.

**Observable outcome:** a player takes a job, traverses the scene with one risk choice, delivers and answers, then returns to an opportunity changed by remembered actions. A second complete round is playable. Divergent saves expose different actionable elements, not merely different lines.

**Founder bar — quoted verbatim from `docs/flagship/BRIEF.md`:**

> - **M-LOOP metric: divergence.** Two save-states with different memory
>   records MUST produce different AVAILABLE ACTIONS on the served page —
>   different job offers, prices, or open routes; dialogue-only differences
>   score zero.
> - **Acceptance (played, not driven):** a taps-only phone-viewport spec seeds
>   two divergent saves, plays one round from each, and asserts the two runs
>   offered DIFFERENT tappable actions (element-level, not text-level). Plus
>   the standing playtest spec extended to complete TWO consecutive rounds.
> - **Definition of DONE for the milestone:** a stranger finishes round one
>   and can answer "what will you do differently next round?" — the retell
>   bar upgraded to a replay bar. (Human playtest evidence; not CI-able —
>   recorded in the devlog per run.)

**Definition of done:** all three clauses above, with linked deployed-page acceptance evidence and human replay-bar evidence. The phone PLAYTEST starts at boot, completes TWO rounds, and asserts every visible dialogue change. All player actions use pointer taps on visible elements; `window.__game` is assert-only. Save seeding is setup, never a substitute for playing either round. An absent, skipped, or red acceptance run leaves M2 open. Merged PRs and closed issues alone do not close the milestone.

**PLAYTEST story:** #1552 exists and is closed, but its issue criteria describe reaching a changed round-two offer, not explicitly finishing round two. Reconcile the actual spec against the stronger founder bar before accepting or replacing this story.

**LoE budget:** one epic, 3–7 S/M stories total, at most one harness-only story per four stories/merges. Initial recovery envelope: four mapped slots below; at most three new M-sized implementation stories after evidence reconciliation, and only for demonstrated player-journey gaps. S means one file; M means 2–3 files. Split wider work before filing.

**Deadline-first cuts:** one scene, one route risk, one mechanical payback channel. Cut extra offer variants, feel polish, and additional channels before cutting complete rounds or divergence. No new NPCs. The founder's standing rule remains: both existing NPCs must repay memory mechanically before introducing another. No future milestone is activated while this gate remains unproven.

## Active milestone's epics

### M2-E1 / M-LOOP-E1 — a player can finish two delivery rounds and act on an opportunity changed by remembered risk/outcome

**Status: ACTIVE — acceptance reconciliation pending.**

**Days remaining: -6 (6 days overdue; inherited 2026-09-05 target, founder confirmation pending).**

**Acceptance criteria:**

1. At `https://game.oodim.com/aftersign`, a phone player taps a visible job, traverses one route with a visible risk choice, delivers, answers, and returns without a harness input call.
2. A remembered risk/outcome changes which job or route control the player can tap. Two divergent saves produce element-level differences after playing a complete round from each.
3. One boot-to-last-beat phone PLAYTEST completes TWO consecutive rounds and asserts every visible dialogue transition and changed available action. Merely reaching the second offer is insufficient.
4. The existing recognition/tone/next-job journey remains reachable by taps.
5. A recorded stranger playtest answers the replay question from the founder bar. No fabricated or inferred human evidence.

**LoE:** four initial S/M story slots; maximum seven after reconciliation, no broader subsystem. Scope and file counts must be verified before any new implementation issue is filed.

**INTEGRATION story:** reuse an existing outcome-gate issue if it covers the full played divergence acceptance; otherwise file that issue FIRST, before implementation stories. #1552 is the existing PLAYTEST candidate, not yet verified as the complete integration gate. No new implementation issues are authorized by this checkpoint. The epic closes when the integration journey passes, not when its parts merge.

**Evidence boundary:** this chunk read the brief, previous plan, current open board, served-entry commit history, merged PR #1726 metadata/reviews, and issue #1552. It did not inspect current gameplay implementation or run acceptance. Old assertions about fixed offers, skipped specs, default CI, or shipped risk recording have been removed rather than presented as present-tense facts.

## Story map — active epic only

Sequence is by overdue acceptance risk, not polish. Existing IDs are mapped before any replacement is filed. Each future issue must start with `Milestone: M2 — ...` and `Epic: M2-E1 — ...`, identify the legacy M-LOOP alias, and state the current days remaining and deadline provenance.

| Order | Player outcome / role | Issue | LoE | Verified status and next decision |
| --- | --- | --- | --- | --- |
| 1 | **INTEGRATION:** a player with either divergent save completes a round and receives different tappable opportunities | Existing gate ID unresolved; prior plan names `job-offers-played.spec.ts` and `m-loop-e1-phone-action-divergence.spec.ts` | M ceiling | Inspect existing gate/evidence; reuse matching issue or file full outcome gate FIRST. Spec paths are prior-plan references, not verified current files. |
| 2 | A player completes TWO consecutive rounds from boot and sees every dialogue change — milestone PLAYTEST | #1552 | M (issue label) | Confirmed closed 2026-09-01. Actual spec, closing PR, full second-round completion, and deployment evidence still unverified. Fold any acceptance-only repair into the integration story rather than proliferating harness-only issues. |
| 3 | A player can select genuinely different jobs based on memory | #1535 | M (prior-plan estimate) | Previous plan reports closed action-divergence wiring; not on current open board. Read issue/current consumer before deciding any gap remains. Do not re-file from stale absence claims. |
| 4 | A player can understand the offered route and risk before choosing | #1551 | M (prior-plan estimate) | Previous plan maps this outcome; not on current open board. Reconcile actual implementation and closure before creating work. Extra copy/feel polish is not critical-path progress. |

A human replay-bar session is a required acceptance task of integration, not another tooling story. If the reconciliation proves the loop incomplete, replace completed story slots with narrowly scoped player fixes; keep 3–7 total mapped stories and the harness-only ration. Do not manufacture implementation work to fill a quota.

## Reality checkpoint — 2026-09-11, planning cycle chunk 1

**Active milestone M2 / M-LOOP: -6 days remaining (6 days overdue).**

- The current open-board query returned exactly #1727 and #1721. The previous checkpoint's #1418, #1345, and #1264 are no longer on that open-board result; no closure or resolution reason was inspected.
- `file_history(aftersign/main.js)` at snapshot `a3358f976871` lists recent landed commits associated with #1726, #1725, #1715, #1710, #1701, #1686, #1673, and #1641. Commit subjects describe target-loss feedback, action gating, feel work, and repairs. Subjects are not acceptance evidence for M2.
- `read_pr(1726)` confirms it merged on 2026-09-11. Its final review describes served target-loss feedback and raises a reticle tap-interception concern. This is review-reported behavior, not a fresh implementation audit or CI run.
- `read_issue(1552)` confirms the existing PLAYTEST issue closed 2026-09-01. Its acceptance reaches a changed second-round offer. Closing an issue with that narrower text cannot by itself prove the founder's TWO-complete-round requirement.
- No new stories filed. No milestone marked done. No current green-main or deployed-playability claim made.

### Drift — open issues serving no mapped epic outcome

Do not close either issue from planning; disposition belongs to the operator/human.

- **#1721 — target-loss reticle/prompt feedback:** no mapped divergence or complete-round outcome; treat as maintenance/polish unless its full issue demonstrates a blocker. The related-looking merged #1726 warrants reconciliation, not an inferred duplicate or automatic closure.
- **#1727 — display-only reticle intercepts taps:** a reported player-input bug, not yet mapped to the loop acceptance path. Read it next chunk and map it into E1 if it blocks the taps-only journey; otherwise keep it as maintenance. Do not dismiss a tap blocker as polish.

### Next chunk — exact handoff

1. Read `aftersign/e2e/m-loop-e1-two-round-playtest.spec.ts`, the exact path named by #1552. If unavailable, locate the canonical replacement with one targeted search; do not assume the issue's proposed file landed.
2. Inspect the divergence acceptance and locate actual run/deployment evidence; check full rounds, taps on visible controls, visible dialogue assertions, and skip status.
3. Read #1727 and #1721 before classifying their implementation scope; reconcile #1721 against merged #1726 without closing it here.
4. Explicitly request founder confirmation of M-LOOP's missing deadline; retain 2026-09-05 and report -6 days at this planning date until authority changes it.
5. Reconcile #1551/#1535 and human replay evidence. Reuse/file the integration gate before any new implementation story, refresh the board before filing, and map only verified S/M gaps.

**Cycle status:** chunk 1 complete; plan reconciliation and story filing are NOT complete. Next chunk starts with the #1552 spec, not another historical-plan rewrite.

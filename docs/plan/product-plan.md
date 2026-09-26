# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world that remembers mechanically: memory changes what the player can do next, not merely what Io says. Deliver the smallest complete replayable loop at https://game.oodim.com/aftersign before adding characters, maps, or polish. Memory is progression; merged components and closed issues are not player acceptance.

Planning checkpoint: **2026-09-26 — chunk 1, source and board reconciliation**. Authority: `docs/flagship/BRIEF.md`, including its August 22 M-LOOP amendment and served divergence contract. M2 / M2-E1 are planning aliases for M-LOOP / M-LOOP-E1, not code-renaming work. Exactly one milestone and one epic are active. Planning reconciliation is not complete; no new stories are authorized until existing acceptance work is inspected.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan; not re-certified this cycle. Former M-CONTINUE.

Definition of done: on the deployed phone surface, a player reaches the return-tone choice and next-job handoff after recognition through visible taps, with each visible dialogue transition asserted.

PLAYTEST: historical #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`, carried from the previous plan, not read or rerun this chunk.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Only regressions blocking M2 enter current execution.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance not yet verified this cycle**. Historical alias: M-LOOP.

**Days remaining: -21 as of 2026-09-26 (21 days overdue).** September 5 is the inherited planning target, not a founder-confirmed M-LOOP deadline. The brief specifies August 22 for the earlier milestones but supplies no explicit M-LOOP deadline. Founder confirmation is still required; do not silently move the target or present it as authorized.

Founder bar, verbatim:

> **M-LOOP metric: divergence.** Two save-states with different memory
> records MUST produce different AVAILABLE ACTIONS on the served page —
> different job offers, prices, or open routes; dialogue-only differences
> score zero.

> **Acceptance (played, not driven):** a Playwright phone-viewport spec
> seeds **two durable memory records**, serves each record through **two
> consecutive rounds**, and taps the rendered page to play them. The records
> pass only when they expose different visible, tappable actions on the served
> page — element/action-level evidence, not merely different copy or a
> different state-machine value. The standing playtest spec is extended to
> complete both consecutive rounds by those player-driven taps.

> **Definition of DONE for the milestone:** a stranger finishes round one
> and can answer "what will you do differently next round?" — the retell
> bar upgraded to a replay bar. (Human playtest evidence; not CI-able —
> recorded in the devlog per run.)

Definition of done:

1. Prepare two divergent durable memory saves before play. **Each save completes two consecutive rounds**, without reseeding between its rounds: take a job, traverse the route with a risk choice, deliver/answer, and return/payback.
2. Compare available action identity or enabled state across the saves on the served page. Different copy, branch stamps, or internal state alone cannot pass. The differing action is visible, enabled, selectable, and part of the played loop.
3. One standing phone PLAYTEST runs from boot through completion of round two for each record, asserting every visible dialogue transition. Reaching offer two is not completing round two.
4. Use a 390×844 touch/mobile viewport and pointer taps on rendered visible elements. `window.__game` is assert-only. No harness input, evaluated DOM clicks, hidden controls, or forced clicks may cause player actions. Preserve recognition, tone response, next-job handoff, and durable continuity at the reload boundary.
5. Attach deployed URL/revision, non-skipped executed test counts, run URL, and trace/video artifacts. Link the dated stranger replay answer and played revision in the public devlog. These are **unverified**, not presumed absent.

PLAYTEST ownership: existing integration identity **#1819**, now confirmed closed. Inspect its landed spec and evidence before deciding whether any residual story is needed. Issue closure alone does not certify the milestone.

LoE budget: **one epic, five existing mapped story identities**. Any verified remaining code work must fit S/M slices (1–3 files each); do not carry the previous plan's unverified L-to-M estimates forward as executable budgets. No new harness-only story is authorized. At most one in four stories may be harness-only.

Time-first order: verify the already-landed played acceptance first; repair only a demonstrated missing player action or incomplete round; collect existing deployed and human evidence next. Cut extra payback channels, polish, recognition depth, new scenes, and new characters before cutting the divergence or two-round bar. Do not replace a product gap with tooling work.

## Active milestone's epics

### M2-E1 — A phone player completes the deployed loop by taps and acts on memory-driven payback

Deadline: 2026-09-05

Days remaining: **-21**, as of 2026-09-26.

Status: **ACTIVE — reconcile landed integration and remaining acceptance**.

Acceptance criteria: every M2 step is reachable on https://game.oodim.com/aftersign by visible pointer taps; two divergent durable saves each complete two consecutive rounds; mechanically different controls are selectable; each visible dialogue change is asserted. Deployed run artifacts and human replay evidence close the milestone.

LoE: five existing story identities; remaining S/M scope is not yet established. No fresh implementation allocation until direct acceptance inspection identifies a gap.

**INTEGRATION + PLAYTEST: #1819 exists and was closed September 25.** Its issue explicitly requires two full rounds per record via rendered controls and integration with the standing playtest suite. Keep it as the original gate identity while inspecting its implementation. Do not file a duplicate because the old plan called it open. If a residual failure is proven, file only that bounded player-visible gap and map it here before its implementation dependencies.

Integration consumers: focused evidence from #1827 and served behavior associated with #1818 must feed the standing full-round PLAYTEST, not substitute for it. No standalone contract or harness is shippable without naming its surface-wiring consumer.

## Story map — M2-E1

Deadline: 2026-09-05

Days remaining: **-21**, as of 2026-09-26.

Existing identities are mapped to prevent duplication. This is a reconciliation map, not five newly authorized tasks. Execution order follows shortest distance to played acceptance.

| Order | Player outcome | Issue | LoE | Status and integration boundary |
| --- | --- | --- | --- | --- |
| Gate first; inspect now | A phone player completes two rounds per divergent save and can explain the next-round consequence | #1819 | L on closed issue; no new allocation | Confirmed CLOSED September 25. Existing INTEGRATION + PLAYTEST; read landed spec and executed evidence next. |
| Reuse | A phone player can select a memory-specific job action | #1535 | M, historical | Prior plan records closed; not freshly read. Reuse rather than rebuild. |
| Reuse | A phone player can read the offered route and risk across memory branches | #1551 | M, historical | Prior plan records closed and PR #1555 merged; not freshly read. |
| Inspect existing behavior before repair | A phone player can select a mechanically different available action after memory changes | #1818 | Previous plan recorded L; residual scope unestimated | Not on current open board. Associated PR #1934 confirmed MERGED September 25; not proof of full two-round acceptance. |
| Consume focused evidence | A phone player loading either durable record sees a deterministic, selectable memory-specific job action | #1827 | M in previous plan | Not on current open board; disposition and landed spec not yet inspected. Must feed the #1819 full-round gate. |

Any new residual story must begin with:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -21 (21 days overdue), as of 2026-09-26
```

Every such story names the served surface, taps-only acceptance, verified 1–3-file boundary, and integration consumer. Update the day count on its actual filing date. Existing stories must be read before splitting or replacing them; a lack of evidence in this chunk is not a feature request.

## Evidence ledger — 2026-09-26

Directly inspected this chunk:

- The founder brief retains the mechanical divergence bar, two consecutive rounds per durable record, visible-pointer acceptance, and human replay evidence. It does not supply a new M-LOOP deadline.
- The open-board query returned **three** issues: #1950, #1920, and #1825. The September 19 plan's seven-open-issue report is stale. Absence from the current board is not proof of successful acceptance or a particular closure reason.
- #1819 is confirmed closed September 25 and retains `loe:L` and `agent-needs-human` labels. Its body requires two complete rounds per record, visible action divergence, and integration with the standing suite. Its body does not provide execution artifacts.
- `file_history(aftersign/main.js)` returned September 26 PR #1959 (commit 98278f2), September 25 PR #1934 (c61bdbb), September 24 #1919, #1917, #1914, #1915, #1908, and September 23 #1902. Commit summaries indicate ongoing served-page changes; they are not runtime proof.
- `read_pr(1934)` confirms MERGED September 25 after a request-changes review and subsequent approvals. Reviewers report served divergence stamping plus a spec that seeds records through the shipped PUT and taps rendered job buttons. This is attributed review evidence, not a direct code inspection or proof of two completed rounds. The PR diff and acceptance execution have not been read this cycle.

Historical leads from the previous plan, **not current findings**:

- `aftersign/e2e/job-offers-played.spec.ts` previously ended at the second offer rather than completing round two.
- `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts` previously had a conditional gate and a potentially labels-only comparison; #1370/#1552 were older integration/PLAYTEST identities.
- The prior renderer inspection questioned whether selecting an offered job affected the played round. Subsequent changes may have resolved this; do not refile from stale evidence.
- #1827 proposed `aftersign/e2e/two-save-tappable-divergence.spec.ts`. Its presence and current contents remain unverified here.

No current test run, deployed trace, or human replay result was retrieved this chunk. Product completion remains unverified, not disproven.

## Drift and operator disposition

- **#1825 — no product epic served:** its open-board title identifies systemic orderless-decomposition/pipeline work. Keep in the operator lane, not M2 product progress. Do not close it here.
- **#1950 — provisionally outside the active story map:** dead-module cleanup and leftover spec wait-budget cleanup, per the board title. Read its body before assigning a dependency; no M2 acceptance blocker established this chunk.
- **#1920 — possible acceptance guardrail, not a divergence outcome:** title requests prevention of harness input in flagship playtests. Read its scope to determine whether it directly protects M2 acceptance or is general maintenance. Do not count it as played product progress from its title alone.

No drift issues are closed. Older drift entries #1808/#1812/#1788 are not on the current open board and are no longer reported as open.

## Next chunk — exact handoff

1. M2 / M2-E1 remains active: **-21 days remaining on September 26**, using the unconfirmed inherited September 5 target.
2. First action: read PR #1934's diff to identify current played spec paths and distinguish focused divergence from full-round acceptance.
3. Find the existing #1819 acceptance implementation with one targeted repository search; read its actual PLAYTEST and evidence before authorizing residual stories.
4. Read #1827's disposition to avoid duplicating focused divergence work.
5. Verify two complete rounds per record, visible dialogue changes, action-level divergence, durable reload continuity, and absence of harness-driven actions.
6. Read #1920/#1950 only as needed to classify overlap and drift against that acceptance path.
7. If acceptance is complete, map evidence and outstanding human replay proof; do not manufacture a fresh epic to replenish the board.
8. If a gap is demonstrated, retain the existing integration identity and file only S/M residual stories, integration first, with canonical headers and day count; preserve a 3–7-story map through reuse.
9. Ask the founder to confirm M-LOOP's date; the brief does not authorize a replacement. Do not silently reschedule.
10. Update this document with actual execution scopes and issue links. Planning completion is not claimed in chunk 1.

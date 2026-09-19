# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world that remembers mechanically: what the player can do next changes, not merely what Io says. Ship the smallest complete replayable loop at https://game.oodim.com/aftersign before adding characters or polish. Memory is progression; merged components are not acceptance.

Planning checkpoint: **2026-09-19**. Authority: `docs/flagship/BRIEF.md`, including the August 22 amendment as read this session. M2 / M2-E1 are planning aliases for M-LOOP / M-LOOP-E1, not code-renaming work. Exactly one milestone and one epic are active.

**Planning status:** updated, but final execution sizing and issue-body reconciliation are incomplete. This revision is a plan, not a code fix. Refs #1818, #1819, #1827. No issue is closed by this document.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan; not re-certified this cycle. Former M-CONTINUE.

Definition of done: on the deployed phone surface, a player reaches the return-tone choice and next-job handoff after recognition through visible taps, with each visible dialogue transition asserted. Historical PLAYTEST: #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`, as recorded by the previous plan, not rerun here.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Only regressions blocking M2 enter current execution.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance incomplete**. Historical alias: M-LOOP.

**Days remaining: -14 as of 2026-09-19 (14 days overdue).** September 5 remains the existing planning target, not a founder-confirmed M-LOOP deadline. The current brief supplies no replacement M-LOOP date. Founder confirmation was requested in prior planning cycles; no authorized replacement is recorded here. Do not silently roll the date forward.

Founder bar, verbatim from the current brief:

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

1. Prepare two divergent durable memory saves before play. **Each save completes two consecutive rounds**, without reseeding between its rounds. Each round includes taking a job, real route traversal with a risk choice, delivery/answer, and return/payback.
2. On the served page, compare available action identity or enabled state across the saves. Different labels, route copy, risk copy, or internal state alone do not satisfy mechanical divergence. The differing action must be visible, enabled, and selectable by a player.
3. The standing phone PLAYTEST goes from boot through completion of round two, asserting every visible dialogue transition. Reaching the second offer is an intermediate checkpoint, not completion.
4. Use a 390×844 touch/mobile viewport and pointer taps on visible controls. `window.__game` is assert-only; no harness input, evaluated DOM clicks, hidden controls, or forced clicks may cause player actions. Preserve reachable recognition, tone response, and next-job handoff. Memory is durable across the acceptance run's reload boundary.
5. #1819 owns acceptance closeout: attach deployed URL and revision, non-skipped executed test counts, run URL, and trace/video artifacts. Record and link a dated stranger's unprompted replay answer with the played revision in the public devlog. These artifacts and human evidence remain **unverified**, not presumed absent.

LoE budget: **one epic; five mapped stories including two historical building blocks**. Remaining execution budget target: #1818 at most M, #1827 at most M, and #1819 at most M, each restricted to 1–3 verified files. #1818 and #1819 currently retain **L labels**; the target budget is not a verified re-estimate. Do not let this document conceal that unresolved sizing blocker.

Time-first cuts: defer polish, extra payback channels, new characters/maps, recognition depth, and any mechanics beyond the minimum divergent selectable action and two completed rounds. Do not cut the divergence or two-round acceptance bar to erase the missed deadline. No additional harness-only story is authorized; test work must exercise the served page and be consumed by #1819.

## Active milestone's epics

### M2-E1 — A phone player completes the deployed loop by taps and acts on memory-driven payback

Status: **ACTIVE — integration acceptance pending**. Historical alias: M-LOOP-E1.

Deadline: 2026-09-05

Days remaining: **-14**, as of 2026-09-19.

Acceptance criteria: every M2 step is reachable on https://game.oodim.com/aftersign by visible pointer taps; two divergent saves each complete two consecutive rounds; mechanically different controls can actually be selected; every visible dialogue change is asserted. Deployed artifacts and human replay evidence are required at closeout.

LoE: five mapped stories, with three existing open issues remaining. Reuse historical #1535/#1551 work. Verify and narrow the two L-labeled stories before calling the remaining scope S/M executable.

**INTEGRATION + PLAYTEST: #1819**, already open. It depends on #1818 and consumes #1827's focused rendered-action evidence. It is the sole active epic/milestone closeout gate. No new integration issue is needed. A successful component test, labels-only inequality, skipped acceptance lane, or run ending at offer two cannot close the epic. Preserve #1370/#1552 as historical evidence/overlap to reconcile, not alternate concurrent gates.

**Implementation boundary:** #1818 owns only residual player-visible divergence behavior. #1827 owns the focused served-page two-save/determinism assertion. #1819 owns complete playable rounds and closeout evidence. Do not rebuild selectors or create another harness-decorated DOM test merely to produce a green component result.

## Story map — M2-E1

Deadline: 2026-09-05

Days remaining: **-14**, as of 2026-09-19.

The integration issue exists first; execution is ordered by the shortest path to playable acceptance. Existing issues are mapped rather than duplicated. No new issues filed this chunk.

| Order | Player outcome | Issue | LoE | Status / dependency / boundary |
| --- | --- | --- | --- | --- |
| Gate established first; closes last | A phone player completes two rounds from each divergent save, selects different actions, and can explain the next-round consequence | #1819 | L currently; M execution target, unverified | OPEN. Existing INTEGRATION + PLAYTEST; depends on #1818, consumes #1827. Owns deployed run artifacts and human replay closeout. No separate evidence issue. |
| Reuse | A phone player can select a memory-specific job action | #1535 | M, historical | CLOSED per prior planning record. Reuse action identity/input work; this record is not current deployed acceptance evidence. |
| Reuse | A phone player can read the offered route and risk across memory branches | #1551 | M, historical | CLOSED per prior planning record; prior plan recorded PR #1555 merged August 31. Reuse rather than rebuild. |
| 1 | A phone player can select a mechanically different available action after memory changes | #1818 | L currently; M execution target, unverified | OPEN. First isolate any residual renderer/control behavior not already wired. Limit repair to the existing scene and one action channel. Coordinate evidence with #1827; do not duplicate its spec. |
| 2 | A phone player loading either durable record sees a deterministic, selectable memory-specific job action | #1827 | M, existing | OPEN. Focused served-page assertion, consumed by #1819. Different data attributes or copy must correspond to an actual selectable action; boot-only divergence does not substitute for two played rounds. |

The five-story map reuses existing identities. #1818/#1819 need bounded, verified execution scopes; all three open story bodies still need canonical milestone/epic metadata and the shared deadline. This document does not change their GitHub labels or bodies. At most one in four stories may be harness-only; no new standalone harness story is authorized. #1552 remains a historical PLAYTEST overlap to reconcile against #1819, not an alternate concurrent gate.

Canonical issue header for the existing open stories when their scope is reconciled:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -14 (14 days overdue), as of 2026-09-19
```

Each story's acceptance must name the served page, visible-pointer interaction, its verified file boundary, and the #1819 integration consumer. A harness-only contract would require a named surface-wiring story and remains subject to the one-in-four cap; none is authorized here.

## Reconciliation and evidence ledger — 2026-09-19

### Direct source inspection

- `aftersign/e2e/job-offers-played.spec.ts` uses 390×844 touch/mobile, navigates to `/aftersign/?slot=…`, taps rendered buttons, and reads `window.__game.scene.ready` only as readiness. It plays one slot through delivery, recognition, tone, handoff, and the next offer. It ends after checking night-transfer/signed-receipt metadata and absence of the safe-default offer. It does **not** play the second round, reload, compare two durable records, or assert every dialogue text change. Its header's delivered-flag explanation must not be treated as the current runtime implementation.
- The inspected `renderText` region of `aftersign/main.js` actually derives offers with `offeredJobsMemoryFromIoMemory(state.npcs.io.memory)` and `selectIoJobOffers`. It renders job buttons with job ID, risk, and semantic fingerprint attributes. This establishes a served consumer exists; it does not prove #1818 or #1827 complete.
- The rendered offer callback records `lastAction`, increments confirmation count, plays feedback, and publishes state. It does not itself advance the beat or durably persist a selected job in that callback. The separate packet controls advance the round. Therefore button/fingerprint divergence alone cannot establish that choosing a different offer changes the played round; #1818/#1819 reconciliation must test the intended mechanical consequence rather than infer it from a stamp.
- `choose('deliver-packet')` at the next-job beat resets packet state and returns to `packet-offered`; it is not completion of a second delivery. `deliverPacket` replaces Io's memory with the current packet-outcome and second-action facts. Do not describe this inspected runtime as accumulating unlimited career history.
- These are static observations, not a deployed execution result. The main.js read was truncated at its end, but the renderer, choice, and delivery regions above were returned.

### Established from reads this chunk

- #1818 is open and L-labeled. Its issue asks for served-page deterministic action divergence, not merely changed text, within the existing scene/characters.
- #1819 is open and L-labeled, explicitly blocked by #1818. It already asks for two complete rounds for each memory record via rendered controls. Retain this existing integration gate.
- #1827 is open and M-labeled. Its exact proposed spec is `aftersign/e2e/two-save-tappable-divergence.spec.ts`, with a possible companion `apps/web/src/aftersign/aftersignLoopDivergencePlaytestSurface.test.ts`. These are issue-described paths, **not independently verified file reads in this chunk**; the first is explicitly proposed as new.
- #1827's acceptance compares the served job button's attribute values across first-run and trusted saves, rendered route/risk copy, and repeat-load determinism. It is focused coverage, not full #1819 acceptance. Its prohibition on editing renderer logic makes it distinct from any actual residual behavior repair in #1818.
- #1827 reports that `main.js` already imports the copy selector and stamps the dynamically created job button, and reports PR #1822 reverted after a harness-decoration test failed review. Treat this as issue-reported context rather than fresh source/diff verification. Do not infer a missing renderer import from search output.
- The current brief explicitly requires **two rounds per durable memory record**. This replaces the stale prior plan's weaker one-round-per-record wording. It supplies no authorized replacement deadline for M-LOOP.
- The refreshed open board contains #1827, #1825, #1819, #1818, #1812, #1808, and #1788. Absence of an older issue from this list does not establish its closure reason or successful acceptance.

### Recent landed history

`file_history(aftersign/main.js)` returned September 18 changes #1829 and #1823; September 17 #1813 (referencing #1812) and #1797; and September 16 #1795, #1794, and #1790. This establishes recent source history, not current green CI or deployed acceptance. In particular, the source now renders `ioReturnLine` in sibling `#ioReturnLine` while retaining `#line` ownership; open #1812 must be reconciled against its acceptance, not blindly implemented again or automatically closed.

### Trusted prior-chunk findings retained without re-derivation

- The inspected job-offer spec uses visible taps but ends at the second offer; it cannot certify two completed rounds.
- #1788 requests reload regression coverage, not full milestone acceptance.
- Recorded renderer findings establish that renderer wiring must be reconciled before assigning new #1818 implementation. The precise remaining player-visible behavior is still unresolved here.
- Landed history references #1812, but its issue remains open. Do not automatically close it from that reference.
- Deployed artifacts and human replay remain unverified; #1819 owns closeout evidence.

### Historical records, not new acceptance claims

The prior plan records #1535/#1551 closed and PR #1555 merged. It also records `aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts` as conditionally skipped unless `M_LOOP_E1_IMPL_LANDED` is set, and its inspected comparison as permitting a labels-only difference. These are earlier inspected findings, not proof of today's deployed behavior or workflow configuration.

#1370 remains a historical integration identity in that spec; #1819 is now the active gate. #1552 remains the historical partial PLAYTEST identity. Their exact current disposition and reusable scope still need issue reads before changing them or declaring their obligations discharged. Do not create duplicate successors while those records are unresolved.

### Still unverified

Current founder-authorized date replacement; exact remaining #1818/#1819 S/M execution scopes; #1827's direct test/wiring; #1370/#1552 historical issue disposition where needed for deduplication; acceptance-lane configuration; successful deployed run artifacts; human replay record. Not inspected is not the same as absent.

## Drift and operator disposition

The refreshed open board returned seven issues: #1827, #1825, #1819, #1818, #1812, #1808, #1788.

- **#1825 — no product epic served:** systemic orderless-decomposition/pipeline work. Operator lane, not M2 player acceptance; keep out of this epic. Do not close it here.
- **#1808 — no direct product epic served:** stuck press-juice PR/WebGL gate escalation, already marked `agent-needs-human`. Operator lane; do not count pipeline recovery as a completed player story. No concrete M2 acceptance-path dependency established.
- **#1812 — outside the active map pending reconciliation:** return-line voice wiring is not itself mechanical action divergence. Recent source history includes its referenced implementation. Confirm disposition; promote only if a concrete blocker of #1819's visible dialogue path is demonstrated. Do not auto-close.
- **#1788 — maintenance, not milestone gate:** reload regression coverage may protect persistence but does not prove two rounds or selectable divergence. Conditional supporting continuity coverage; keep outside the active map unless needed to unblock #1819.

No drift issues are closed by this plan. The previous plan's #1727/#1721 are not in this returned open list; do not invent a closing reason or continue reporting them as open.

## Completion blocker / exact remaining handoff

1. Active M2 / M2-E1 remains due September 5: **-14 days remaining** on September 19.
2. Keep #1819 as the existing INTEGRATION + PLAYTEST gate, dependent on #1818; never file a duplicate.
3. Next action: reconcile #1818's residual selectable-action behavior against the recorded renderer findings and #1827's exact spec boundary; verify a 1–3-file execution scope rather than invent missing wiring.
4. Bound #1819 to a verified 1–3-file served PLAYTEST change, including both complete rounds per save and each visible dialogue transition. Evidence links belong in its closeout record.
5. Reconcile #1370/#1552 dispositions only to identify the existing spec to extend and avoid duplicate acceptance work.
6. Add canonical milestone/epic/deadline headers to the existing open stories and obtain accurate S/M labels; this session has not changed issue metadata.
7. Reconcile #1812's open state against the reported landed history without automatically closing it.
8. Inspect the exact #1827 spec when present; its issue request was read here, not its implementation. Keep it focused on served divergence and determinism consumed by #1819.
9. Preserve the five-story map unless verified scope requires a bounded split; do not pad the backlog with harness-only stories.
10. Planning completion remains blocked on verified S/M scopes and issue reconciliation. Product completion additionally requires deployed artifacts and human replay evidence; neither is claimed here.

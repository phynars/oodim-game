# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world that remembers it mechanically: what the player can do next changes, not merely what Io says. Build the smallest complete, replayable loop on https://game.oodim.com/aftersign before adding characters, systems, or polish. Memory is progression; merged components are not milestone acceptance.

Planning checkpoint: **2026-09-19, chunk 3**. Product authority: `docs/flagship/BRIEF.md`, especially the previously inspected August 22 amendment. Current identifiers M2 / M2-E1 alias historical M-LOOP / M-LOOP-E1; this is not a code-renaming project. Exactly one milestone and one epic are active. This revision records source inspection and board reconciliation, not a successful deployed playtest.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan; not re-certified this cycle.

Definition of done: on the deployed phone surface, a player reaches the return-tone choice and next-job handoff after recognition through visible taps, with each visible dialogue transition asserted. Historical PLAYTEST: #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`, as recorded by the previous plan, not rerun here.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Only regressions blocking M2 enter current execution.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance incomplete**.

**Days remaining: -14 as of 2026-09-19 (14 days overdue).** September 5 remains the existing planning target, not a founder-confirmed replacement. Prior chunks requested founder confirmation. No authorized replacement has been verified; retain the missed date rather than rolling it forward.

Founder bar retained from the previous plan's August 22 brief transcription:

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

1. On the deployed page, divergent memory saves support job → route traversal with one risk choice → delivery/answer → return/payback. Different available actions are proved by action identity or enabled state, not dialogue or labels alone; the player actually selects the differing action.
2. A continuous 390×844 touch/mobile PLAYTEST runs from boot through **two completed rounds**, asserting each visible dialogue change. Round two's offer is an intermediate checkpoint, not completion. #1819's existing stronger scope, confirmed by the prior chunk, requires two durable records each played through two complete rounds; preserve it.
3. Game actions use pointer taps on visible enabled controls. `window.__game` is assert-only; no harness input, evaluated DOM clicks, forced clicks, hidden controls, or mid-run reseeding. Initial divergent-save setup is allowed before play.
4. Recognition, tone response, and next-job handoff remain reachable. Memory is durable across the acceptance run's reload boundary.
5. Record deployed URL/revision, non-skipped executed test counts, run URL, trace/video artifacts, and a dated stranger replay answer in the public devlog. Link evidence here before marking DONE.

LoE budget: **one epic, four provisional mapped stories** below, reusing existing work. Target each remaining code execution at S (one file) or M (2–3 files, one behavior); #1818/#1819 currently carry L labels and have NOT yet been reconciled to verified S/M execution boundaries. No new implementation ladder is authorized until that reconciliation. Evidence closeout belongs to the integration gate, not an unconsumed harness subsystem.

Time-first order: establish the existing integration gate → identify its first concrete served-path failure → repair only that failure → finish and run the two-round proof → record human replay. Cut copy/feel polish, extra payback channels, extra characters, and depth beyond two rounds before changing the date. Do not cut mechanical divergence or complete-round acceptance.

## Active milestone's epics

### M2-E1 — A phone player completes the deployed loop by taps and acts on memory-driven payback

Status: **ACTIVE — source/acceptance reconciliation in progress**.

Days remaining: -14 as of 2026-09-19.

Acceptance: every M2 step is reachable on the deployed phone surface by visible pointer taps; two durable histories yield different selectable mechanical actions; both complete-round continuity and each dialogue change are asserted; deployed artifacts and human replay evidence are attached.

LoE: four provisional mapped existing stories, no duplicate contracts. S/M execution scopes must be verified before filing any additional implementation work. Historical closed building blocks #1535 and #1551 remain reused background work, not fresh authorizations.

**INTEGRATION + PLAYTEST: #1819**, already open and dependent on #1818. This supersedes the previous plan's unresolved choice of #1370 as the current gate. Preserve #1370/#1552 as historical evidence/overlap to reconcile, not alternate concurrent gates. The epic is done only when #1819's played outcome and evidence pass, not when its dependencies merge.

## Story map — M2-E1

Days remaining: -14 as of 2026-09-19. This is a provisional reconciliation map, not a declaration that L issues have become M. No new issues filed in chunk 3.

| Order | Player outcome | Existing issue | Execution budget / status | Evidence responsibility |
| --- | --- | --- | --- | --- |
| 0 | A phone player completes two rounds from each divergent durable record and acts on different available choices | #1819 | OPEN INTEGRATION + PLAYTEST; currently L; bounded S/M execution unresolved; depends on #1818 | Integration implementer owns complete dialogue assertions, deployed revision/run/counts/trace, and linking the human replay record; operator recruits a stranger |
| 1 | A returning phone player can tap the mechanically differing job/route action and continue the round | #1818 | OPEN; currently L; inspect remaining behavioral gap before bounding S/M or splitting | Runtime implementer proves a concrete failing path is repaired on `/aftersign/`, consumed by #1819; do not rebuild already rendered offers |
| 2 | A phone player sees and taps different available actions from two saved histories | #1827 | OPEN M; narrower two-save served DOM proof per prior chunk; overlap/wiring still needs direct verification | Spec implementer supplies element-level action divergence to #1819; not a substitute for two completed rounds |
| 3 | A phone player continues from boot beyond the second offer through the second completed delivery/return | #1552 | Historical PLAYTEST overlap, M in previous plan; current issue disposition unresolved | Reuse existing continuous-run spec in #1819; prior inspection found a second-offer stopping point, not full completion |

At most one in four stories may be harness-only; authorize none as a new standalone harness now. #1827 must remain a served-page assertion consumed by the integration gate. The final chunk must resolve #1552 overlap and establish verified S/M remaining execution before declaring the map final.

New story body prefix, if a genuinely uncovered gap needs filing:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -14 (14 days overdue), as of 2026-09-19
```

## Evidence reconciliation — 2026-09-19, chunk 3

### Direct source inspection

- `aftersign/e2e/job-offers-played.spec.ts` uses 390×844 touch/mobile, navigates to `/aftersign/?slot=…`, taps rendered buttons, and reads `window.__game.scene.ready` only as readiness. It plays one slot through delivery, recognition, tone, handoff, and the next offer. It ends after checking night-transfer/signed-receipt metadata and absence of the safe-default offer. It does **not** play the second round, reload, compare two durable records, or assert every dialogue text change. Its header's delivered-flag explanation must not be treated as the current runtime implementation.
- The inspected `renderText` region of `aftersign/main.js` actually derives offers with `offeredJobsMemoryFromIoMemory(state.npcs.io.memory)` and `selectIoJobOffers`. It renders job buttons with job ID, risk, and semantic fingerprint attributes. This establishes a served consumer exists; it does not prove #1818 or #1827 complete.
- The rendered offer callback records `lastAction`, increments confirmation count, plays feedback, and publishes state. It does not itself advance the beat or durably persist a selected job in that callback. The separate packet controls advance the round. Therefore button/fingerprint divergence alone cannot establish that choosing a different offer changes the played round; #1818/#1819 reconciliation must test the intended mechanical consequence rather than infer it from a stamp.
- `choose('deliver-packet')` at the next-job beat resets packet state and returns to `packet-offered`; it is not completion of a second delivery. `deliverPacket` replaces Io's memory with the current packet-outcome and second-action facts. Do not describe this inspected runtime as accumulating unlimited career history.
- These are static observations, not a deployed execution result. The main.js read was truncated at its end, but the renderer, choice, and delivery regions above were returned.

### Recent landed history

`file_history(aftersign/main.js)` returned September 18 changes #1829 and #1823; September 17 #1813 (referencing #1812) and #1797; and September 16 #1795, #1794, and #1790. This establishes recent source history, not current green CI or deployed acceptance. In particular, the source now renders `ioReturnLine` in sibling `#ioReturnLine` while retaining `#line` ownership; open #1812 must be reconciled against its acceptance, not blindly implemented again or automatically closed.

### Other candidate coverage

Read #1788: it requests restoring a disabled reload-beat regression spec by aligning a shared state field and removing `test.fixme`. Its source has not been inspected in this chunk. Treat it as supporting M2 continuity coverage, not the milestone PLAYTEST: its issue acceptance does not establish taps-only two-round play. Promote into the active map only if it repairs a concrete integration blocker without duplicating #1819.

### Still unverified

Current founder-authorized date replacement; exact remaining #1818/#1819 S/M execution scopes; #1827's direct test/wiring; #1370/#1552 historical issue disposition where needed for deduplication; acceptance-lane configuration; successful deployed run artifacts; human replay record. Not inspected is not the same as absent.

## Drift and operator disposition

The refreshed open board returned seven issues: #1827, #1825, #1819, #1818, #1812, #1808, #1788.

- **#1825:** systemic pipeline decomposition work, no player-outcome epic served in this product plan. Operator disposition; do not close it here.
- **#1808:** human-needed recovery of stuck press-juice PRs, not an active M2 story. No concrete M2 acceptance-path dependency established. Keep outside the product execution map unless such a dependency is shown.
- **#1812:** related to M2's recognition surface, but recent source history includes its referenced implementation. Acceptance/issue-state reconciliation required; not fresh work and not declared drift solely because it remains open.
- **#1788:** relevant to reload continuity, conditional supporting coverage; not unrelated drift and not a replacement for integration.
- The previous plan's #1727/#1721 are not in this returned open list. Do not invent a closing reason or continue reporting them as open.

## Final-chunk handoff

1. Read #1818 FIRST and identify the exact still-unmet player-surface behavior against the source observations above; do not re-read main.js wholesale.
2. Read #1819 only as needed to bound implementation to verified S/M execution; retain it as the open INTEGRATION + PLAYTEST gate.
3. Directly inspect #1827's identified served spec/wiring and merge overlapping acceptance ownership into #1819 rather than filing duplicates.
4. Reconcile #1552/#1370 disposition only if necessary to finalize the 3–7 story map; source history is not acceptance.
5. Locate deployed artifacts and human replay evidence; assign missing closeout under #1819, with no green-by-assumption.
6. #1788 is supporting continuity coverage, not automatically a new active story. #1812 needs landed/open reconciliation.
7. Refresh the board before any filing. File only verified uncovered S/M gaps, integration-first, with the required milestone/epic/date prefix.
8. Retain September 5 and **-14 days remaining** unless the brief supplies an authorized replacement.
9. Finish the plan/map and report #1825/#1808 as outside product-epic execution; do not close them.
10. This cycle is NOT complete. Use META-DONE only after remaining scopes and evidence ownership are reconciled.

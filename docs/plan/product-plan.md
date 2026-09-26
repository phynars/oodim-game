# AFTERSIGN — product plan

## Vision

A phone player takes a delivery job, makes a consequential choice, and returns to a world that remembers mechanically: what the player can do next changes, not merely what Io says. Ship the smallest complete replayable loop at https://game.oodim.com/aftersign before adding characters or polish. Memory is progression; merged components are not acceptance.

Planning checkpoint: **2026-09-26**. Authority: `docs/flagship/BRIEF.md`. M2 / M2-E1 are planning aliases for M-LOOP / M-LOOP-E1, not code-renaming work. Exactly one milestone and one epic are active.

**Planning status: acceptance reconciliation incomplete.** This revision corrects stale issue states and records the inspected boundary of PR #1934; it does not certify deployed acceptance or implement a fix. Refs #1818, #1819, #1827. No issue is closed by this document.

## Milestones

### M1 — A phone player continues past Io's recognition into a tone response and the next job

Deadline: 2026-08-22

Status: historical completion reported by the previous plan; not re-certified this cycle. Former M-CONTINUE.

Definition of done: on the deployed phone surface, a player reaches the return-tone choice and next-job handoff after recognition through visible taps, with each visible dialogue transition asserted. Historical PLAYTEST: #1216 and `aftersign/e2e/m-continue-phone-tap-playtest.spec.ts`, as recorded by the previous plan, not rerun here.

LoE budget: historical one-epic delivery; **zero new stories authorized**. Only regressions blocking M2 enter current execution.

### M2 — A phone player completes two delivery rounds and can name what memory lets them do differently next round

Deadline: 2026-09-05

Status: **ACTIVE — acceptance unverified**. Historical alias: M-LOOP.

**Days remaining: -21 as of 2026-09-26 (21 days overdue against the existing planning target).** September 5 is not a founder-confirmed M-LOOP deadline. The brief read this chunk supplies dated August milestones but no M-LOOP deadline. Founder action required: confirm the binding M-LOOP date. Do not silently roll the target forward or present September 5 as founder-authorized.

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
2. Compare available action identity or enabled state across the saves on the served page. Different labels, copy, or internal state alone do not satisfy mechanical divergence. The differing action must be visible, enabled, and selectable.
3. The standing phone PLAYTEST goes from boot through completion of round two, asserting every visible dialogue transition. Reaching the second offer is not completion.
4. Use a 390×844 touch/mobile viewport and pointer taps on visible controls. `window.__game` is assert-only; no harness input, evaluated DOM clicks, hidden controls, or forced clicks may cause player actions. Preserve recognition, tone response, and next-job handoff. Verify durable memory across the acceptance run's reload boundary.
5. The integration closeout record must link deployed URL and revision, non-skipped executed test counts, run URL, trace/video artifacts, and a dated stranger's unprompted replay answer in the public devlog. These artifacts and human evidence remain **unverified**, not presumed absent.

LoE budget: **one epic; five existing story identities**. Authorize no speculative new implementation. Any demonstrated remaining gap must be bounded to S/M (1–3 verified files), integration first. #1819 is closed with an L label; closure does not resolve its acceptance or establish a smaller execution scope.

Time-first cuts: defer polish, extra payback channels, new characters/maps, and recognition depth. Prioritize the shortest path to two playable rounds and one mechanically divergent selectable action. Do not cut the divergence or two-round bar to erase the missed target. No additional standalone harness story is authorized.

## Active milestone's epics

### M2-E1 — A phone player completes the deployed loop by taps and acts on memory-driven payback

Deadline: 2026-09-05

Days remaining: **-21**, as of 2026-09-26; provisional planning target, founder confirmation required.

Status: **ACTIVE — integration acceptance not yet verified**.

Acceptance criteria: every M2 step is reachable on https://game.oodim.com/aftersign by visible pointer taps; two divergent saves each complete two consecutive rounds; mechanically different controls can actually be selected; every visible dialogue change is asserted. Deployed artifacts and human replay evidence are required at closeout.

LoE: five mapped existing stories; remaining executable S/M scope unresolved. Reuse landed work before assigning repairs.

**INTEGRATION + PLAYTEST identity: #1819**, closed September 25. Its issue explicitly requires two complete rounds per memory record through rendered controls. Retain it as the acceptance reconciliation anchor, not as an open backlog item or a proven pass. Locate its actual full-round spec and execution evidence before filing an overlapping successor. If a residual gap is demonstrated, establish a bounded integration follow-up before implementation stories and cross-link #1819.

**Focused evidence: #1827**, closed September 23. Its issue asks for two-save rendered attributes/copy and repeat-load determinism, not two complete rounds. Its implementation and closure evidence have not yet been inspected this chunk.

**PR #1934 boundary:** the inspected added `aftersign/e2e/mloop-served-divergence-played.spec.ts` seeds fresh and completed saves through `/aftersign/save`, boots each at `packet-offered`, reads the rendered tray's memory attribute, and taps the first visible offered-job button. It compares memory labels and tapped offer IDs. It does not assert any post-tap progression, play either record through two rounds, assert dialogue transitions, or repeat-load a record for determinism. It is useful focused served-page coverage, not the full integration gate. Its presence does not establish whether another full-round spec exists.

## Story map — M2-E1

Deadline: 2026-09-05

Days remaining: **-21**, as of 2026-09-26.

Integration was established first. The immediate order is acceptance reconciliation, demonstrated minimum repair, then executed closeout—not additional component work. No new stories filed this chunk.

| Order | Player outcome | Issue | LoE | Status / boundary |
| --- | --- | --- | --- | --- |
| Gate first; verify now | A phone player completes two rounds from each divergent save, selects different actions, and can explain the next-round consequence | #1819 | L label; remaining S/M scope unverified | CLOSED September 25, directly read. Existing INTEGRATION + PLAYTEST identity. Full-round implementation, deployed run, and human replay evidence still need inspection. |
| Reuse | A phone player can select a memory-specific job action | #1535 | M, historical | CLOSED per prior plan; not re-certified this cycle. |
| Reuse | A phone player can read the offered route and risk across memory branches | #1551 | M, historical | CLOSED per prior plan; PR #1555 historically recorded as merged August 31. |
| Reconcile only if needed | A phone player can select a mechanically different available action after memory changes | #1818 | Historical L; residual scope unknown | Not on the current open board. Exact disposition not read this chunk; do not infer acceptance from absence. Reuse renderer work before assigning any repair. |
| Reuse focused evidence | A phone player loading either durable record sees a deterministic, selectable memory-specific job action | #1827 | M | CLOSED September 23, directly read. Inspect implementation/evidence before duplicating its focused coverage. Does not own full-round acceptance. |

This is a reconciled identity map, **not yet a fully sized executable backlog**. Closed stories are not queued work. Do not pad the count with duplicate coverage issues. Any newly demonstrated gap must name its integration consumer and served surface. At most one in four stories may be harness-only; no standalone harness work is authorized here.

Required top-of-body metadata for any newly filed active-epic story:

```text
Milestone: M2 — a phone player completes two delivery rounds and sees memory change available actions
Epic: M2-E1 — a phone player completes the deployed loop by taps and acts on memory-driven payback
Deadline: 2026-09-05
Days remaining: -21 (21 days overdue against provisional target), as of 2026-09-26
```

## Reconciliation and evidence ledger — 2026-09-26

### Directly inspected this chunk

- `read_pr_diff(1934)`: focused spec boundary described above. The diff also wires a memory-posture attribute into the offered tray and adds helper unit coverage. Static inspection is not an executed deployed result.
- `read_issue(1819)`: closed September 25; explicit two-record, two-round, visible-control phone acceptance; L label retained. No full-round spec path or execution artifact was supplied in the returned issue body.
- `read_issue(1827)`: closed September 23; focused rendered divergence and determinism scope. Its proposed `aftersign/e2e/two-save-tappable-divergence.spec.ts` path is an issue-described new file, not a verified existing file here. Closed status is not proof its acceptance ran.
- `read(docs/flagship/BRIEF.md)`: two complete rounds per record, action-level divergence, visible taps, and human replay remain required. The served-tray amendment adds a focused contract; it does not remove the full-round bar. No binding M-LOOP date found.
- `list_issues(state=open, limit=30)`: three open issues returned: #1950, #1920, #1825. The old seven-issue open-board snapshot is superseded.

### Trusted previous-chunk evidence

PR #1934 merged September 25; its reviews describe focused served-page divergence coverage. This chunk inspected the diff rather than re-fetching that merge status. Deployed execution artifacts and human replay evidence were not verified by either chunk.

### Historical observations retained, not re-certified

The previous plan inspected `aftersign/e2e/job-offers-played.spec.ts` and recorded that it ended at the next offer, not completion of round two. It also recorded that offer-button callbacks alone did not prove round progression or persistence of the selected job. Those observations motivate reading the current owning spec/runtime if necessary; they are not a fresh claim that current gameplay is broken.

#1370 and #1552 remain historical integration/PLAYTEST identities to consult only if needed to locate the full-round spec and avoid duplication. Do not turn their uninspected disposition into new work.

## Drift and operator disposition

Current open board: #1950, #1920, #1825. No issues closed here.

- **#1825 — no product epic served:** pipeline/orderless-decomposition work, per trusted prior-chunk classification and current title. Keep in operator lane, not M2 player acceptance.
- **#1950 — provisional maintenance-only:** title requests dead-module removal and leftover wait-budget cleanup. No M2 outcome dependency established; read the body before final classification.
- **#1920 — possible supporting acceptance guardrail:** title requests protection against harness input hooks. Could support M2's played-not-driven bar, but is not itself the complete played outcome. Read the body before classifying as drift or mapping it.

## Exact remaining handoff

1. M2 / M2-E1 remains active at **-21 days remaining** against the provisional September 5 target; ask founder to confirm the binding date.
2. PR #1934's inspected played spec proves only seeded offer-tray divergence plus one tap per record, not complete rounds or post-tap effects.
3. Exact next action: search for the full-round spec associated with #1819, then read it; use PR evidence if repository reads cannot access `aftersign/` paths.
4. Check two rounds for each durable record, visible dialogue changes, selectable divergence, and absence of action-causing harness hooks.
5. #1827 is closed September 23; inspect its landed focused spec only as needed to avoid overlapping work and verify determinism coverage.
6. Retrieve deployed non-skipped execution artifacts and human replay evidence. Neither is verified; neither is declared absent.
7. Read #1950/#1920 bodies before final drift classification; #1825 remains operator work.
8. File only demonstrated bounded S/M gaps, integration first, with canonical metadata and current days remaining. Reuse existing identities/evidence.
9. Finish story-map sizing and artifact links. Do not mark M2 done from issue closure, merged components, or tray attributes alone.

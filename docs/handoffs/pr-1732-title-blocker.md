# PR #1732 — title-only blocker, human retitle required

**Status:** stuck at 5× REQUEST_CHANGES on the auto-reviewer.
**Head branch:** `agent/6dd8b31e`
**Diff:** docs-only, single file (`docs/plan/product-plan.md`).
**Body scoping:** already correct — `Refs #1731, not Closes`, verbatim on line 9 of the plan doc.

## The blocker

All five review verdicts object to the same thing: the PR title still reads

    fix: M-LOOP-E1 integration done-gate: taps-only phone spec proves two (#1731)

but the diff does not touch
`aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts`, where #1731's
acceptance lives. The reviewer's requested title is

    docs/plan: M2/M-LOOP done-gate reconciled; verbatim founder bar; 4-story budget (Refs #1731)

and once that lands the PR merges. The plan content is otherwise
approved.

## Why iterate /code can't fix this

An iterate session pushes commits onto the existing PR branch. The PR
title was set from the original session's first prompt line and there
is no tool exposed to iterate that mutates PR metadata — only `write`,
`edit`, and `delete` on repo files. Five prior docs-only commits could
not and did not move the title. A sixth won't either.

## Requested human action (pick one)

1. **Retitle #1732 manually** to `docs/plan: M2/M-LOOP done-gate
   reconciled; verbatim founder bar; 4-story budget (Refs #1731)`, then
   re-request review. Cheapest path.
2. **Close #1732 and reopen** a fresh PR from `agent/6dd8b31e` with the
   correct title. Same diff, correct label.
3. **Override the auto-reviewer** if the plan content is acceptable and
   the title mismatch is tolerable this once. Not recommended — sets a
   precedent that mislabels plan revisions as fixes.

## What #1731 still needs (separate PR)

Independent of this title fix, #1731's actual acceptance — a taps-only
phone-viewport spec seeding two divergent memory saves and asserting
element-level action divergence in
`aftersign/e2e/m-loop-e1-phone-action-divergence.spec.ts` — remains
open. That is a code PR, not a docs PR, and should be picked up by a
fresh /code session against #1731 after this planning PR is either
merged (retitled) or closed-and-reopened.

## Ops trail

- Telegram ops notified 2026-09-12 with the three options above.
- PR comment on #1732 links to this handoff.

Refs #1731. Refs #1732.

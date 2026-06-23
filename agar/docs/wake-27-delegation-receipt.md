# Wake 27 — #276 delegation receipt

> **Scope of this PR (Refs #234, Refs #276 — does NOT close either).**
> This file is a wake-trail artifact. It documents that #276 was
> delegated; it does **not** implement #234's AC3. The actual
> `DESYNC_BROKEN` / `AGAR_DO_BREAK_MODE` build-flag work lands in the
> PR that closes #276. The PR title was over-stated at creation
> (titles are immutable from iterate sessions); treat this diff as a
> docs-only receipt, nothing more. Reviewer should evaluate it as
> such — there is no code under `agar/server/` in this diff and there
> shouldn't be.

**Studio Head**: Mara Okonkwo
**Wake**: 27 (commit 1b05b3cc)
**Action**: delegated #276 (agar AC3 — DESYNC_BROKEN build-flag) to Marcus.

## Why delegated (not DIY, not waiting)

Per `agar-gate-check` skill's decision matrix:

| #276 state | Action |
|------------|--------|
| open, no PR, idle 2 wakes | delegate |

State at wake 27:
- `list_issues`: #276 open.
- grep `AGAR_DO_BREAK_MODE|DESYNC_BROKEN` across repo: 17 matches, ALL
  in docs (`agar/docs/`, `e2e-shared/multiplayer/`). Zero in
  `agar/server/`. Implementation has not started.
- Wake trail confirms wake 26 was also idle, no PR.

Two-wakes-idle trigger met → delegate.

## What Marcus was given

1. **Plan doc**: `agar/docs/desync-broken-fixture-plan.md` (reducer-callsite
   guidance, env contract, CI shape, three gotchas).
2. **Issue body**: #276's five acceptance criteria + scope fences.
3. **The byte-lock**: `agar/e2e/multiplayer-convergence.spec.ts` MUST
   NOT be edited — that is the gate's integrity.
4. **PR body requirement**: `Closes #234 Closes #180`.

Budget: 250¢ (out of my $7.69 daily).

## What lands when #276 merges

- #234 closes (4/4 ACs satisfied: ordering + reconnect + zero
  `waitForTimeout` from a146123; AC3 from this PR).
- #180 closes (the two-client e2e RUNG).
- Multiplayer rung PROVEN. Pivot trigger: persistence epic.

## What I do next wake (28)

Per wake-trail.md decision tree:

1. `list_issues` for Marcus's PR.
2. If PR open → `review_pr` against the 4 bullets.
3. If merged → file persistence slice 1 from
   `agar/docs/persistence-epic-plan.md` (which landed this wake — my
   wake-26 workspace draft made it in-repo).
4. If Marcus failed → DIY against the same plan doc (no third agent
   attempt; the spec is unambiguous).

## Cross-axis note

`e2e-shared/multiplayer/PERSISTENCE-HARNESS-CONTRACT.md` exists at
this commit — Soren is scoping persistence harness shape ahead of the
rung close (mirrors `AGAR_DO_BREAK_MODE` as `PERSISTENCE_BREAK_MODE`).
When I file slice 1, READ THAT DOC FIRST — slice 2/3 specs must align
with the harness shape Soren has staked.

---

This file is a wake-trail artifact, not a contract. Safe to delete
once #276 merges and its history is captured in the closing PR.

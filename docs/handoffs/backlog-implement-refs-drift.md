# Handoff — backlog-implement prompt tells agents `Refs #N` (should be `Closes #N`)

**Refs oodim-game#2014.** This is a **spec-only** handoff, not a fix. The
broken code lives in a different repo (`phynars/oodim`, the platform), which
is unreachable from the oodim-game snapshot. The prior attempt at fixing
this in oodim-game (PR #2015, first pass) planted a corrected copy at
`apps/cron/src/backlog-implement.ts` that nothing imported — dead on
arrival. This doc replaces that dead file with a pointer to the real target.

## Problem (from #2014)

The backlog-implement cron in `phynars/oodim` builds a prompt that tells
the implementing agent:

> End your reply with `Refs #N` so the issue auto-closes when the PR merges.

GitHub does not auto-close on `Refs`. Only `Closes`, `Fixes`, `Resolves`
(and their variants) close a linked issue on merge. As a result, fully
delivered issues stay open and drift. The meta-moderator has been
hand-closing them.

Concrete drift observed in oodim-game:
- #1994 — delivered by merged PR #1995, stayed open.
- #1988 — delivered by merged PR #1989, stayed open.

## Target repo & file (fix must land here, NOT in oodim-game)

- **Repo:** `phynars/oodim`
- **Locate with:** `grep -r "End your reply with" apps/ packages/ workers/`
- **Likely area:** the cron worker's backlog-implement task — the prompt
  builder that assembles the /code session prompt for a picked-up
  agent-filed issue. Search terms that should land on it:
    - `"End your reply with"`
    - `"backlog-implement"` / `backlogImplement`
    - `buildImplementPrompt` / `buildBacklogPrompt` / similar

## Required change (one-liner)

In the prompt-builder string, replace:

    End your reply with `Refs #${issueNumber}` so the issue auto-closes …

with:

    End your reply with `Closes #${issueNumber}` so the issue auto-closes
    when the PR merges. (Docs-only PRs are downgraded to `Refs` by
    closes-guard.ts — that behavior is intentional and must not change.)

Two things matter:
1. The keyword the agent is told to emit changes from `Refs` to `Closes`.
2. The claim that `Refs` auto-closes is removed — because it doesn't.

## Acceptance criteria (from #2014)

- For issues the implement session is expected to satisfy, the implement
  prompt tells the agent to end with `Closes #N`.
- The docs-only guard in `closes-guard.ts` still downgrades docs-only PRs
  to `Refs` (unchanged).
- The prompt no longer claims that `Refs` auto-closes.

Alternative path (also acceptable per the issue): a post-merge job that
closes any issue linked with `Refs #N` from a merged PR whose session was
an implement run for that issue. The prompt fix is strictly simpler.

## Scope / non-goals

- Do NOT change `closes-guard.ts` docs-only downgrade behavior.
- Do NOT change the review-cron, moderator, or any non-implement prompt
  builder — only the backlog-implement path is broken.
- Nothing in oodim-game (this repo) needs to change. The prior attempted
  fix at `apps/cron/src/backlog-implement.ts` has been removed as dead
  code by this PR.

## Verification after the oodim-side fix lands

1. Trigger a backlog-implement run against a small agent-filed issue in
   oodim-game.
2. In the /code session prompt sent to the agent, confirm the trailing
   instruction reads `Closes #N`, not `Refs #N`.
3. Merge the resulting PR; confirm GitHub auto-closes the issue (no
   meta-moderator hand-close needed).

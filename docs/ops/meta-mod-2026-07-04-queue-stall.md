# Ops note — task-queue stall + review-backlog drain (2026-07-04)

Meta-moderator tick (Charlie Shin), scoped to phynars/oodim-game.

## Incident: task queue stalled

Evidence (read from the live DB + worker logs during the tick):

- `task_queue`: 15 pending jobs; oldest `auto_review_pr` created 13:02
  (~3h at time of tick); ALL pending rows had `attempts=0` and
  `started_at=null` — nothing was being picked up, not retried-and-failing.
- Worker observability: **zero** log events from `oodim-web-staging`
  and `oodim-cron-staging` over the last 60 minutes.
- `code_sessions`: a 14:01 free-will session was janitor-aborted with
  "orphaned pending > 30 min, worker likely died mid-run".

Diagnosis: the queue consumer/cron is DOWN, not slow. Restart is
platform-side (outside this repo) — escalated to the ops Telegram
channel at tick time.

## Backlog drained by hand while the queue was down

| PR   | State at tick | Action | Why |
|------|---------------|--------|-----|
| #373 | open, CI green | APPROVE + MERGE | Galaga pause (`HELD.`), faithful to #368's contract; freeze/resume/Esc-parity e2e. #368 closed as shipped. |
| #371 | open, CI green | APPROVE + MERGE | Title said "leaderboard slice 1" but the diff is the AC4 red-polarity-eviction CI job, un-commented per the in-file plan. Mislabel flagged in review so it can't claim #369. |
| #372 | open, CI red | REQUEST_CHANGES | Spec navigates to `/galaga/` where sibling specs use `/`; polling-based tick sampling makes the exact-4-tick cadence assertion structurally flaky. |
| #375 | open, CI red | REQUEST_CHANGES | Real #369 implementation, but the agar multiplayer-convergence green-polarity job fails — touches the live DO/tick path; needs local repro + fix. |
| #366 | open, CI green | none (correctly blocked) | Awaits its queued re-review, which is stuck behind the stalled queue; self-merge of unreviewed work is refused by design. |

## Follow-ups

- Platform: confirm queue worker restart; the 15 pending jobs should
  drain on their own once the consumer is back (all are `attempts=0`).
- #375: fix convergence regression, keep `Closes #369` there.
- #372: move spawn-tick sampling to an in-page probe (fireProbe
  pattern) and fix the goto path, then re-push.
- Lesson for future ticks: free-will PR titles can mislabel content
  (#371) — always read the diff, never trust the title.

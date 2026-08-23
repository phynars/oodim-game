# Meta-Moderator cycle hand-off — chunk 1 (2026-08, commit 286cda7)

Operator triage of phynars/oodim-game. This chunk INVESTIGATED; the next
chunk IMPLEMENTS. Refs #1383.

## Confirmed this chunk

1. **Parked (`agent-needs-human`) issues — both still legitimately blocked:**
   - #1345 (Mara): PR-review job-logs endpoint 401 — needs a human token
     rotation; nothing repo-side to port.
   - #1264 (Charlie): task_queue "janitor: orphaned" jobs never retried —
     needs a DB-write/janitor change outside this repo's write scope.
     NOTE: `query_db` on task_queue failed with the read-only wrapper error
     (`Failed query: SELECT * FROM (... GROUP BY ...) q_ LIMIT 51`); retry
     with a simpler ungrouped/aliased query next chunk to health-check the
     orphan count.

2. **M-LOOP chain (#1382 → #1383 → #1384 → #1385):**
   - #1382 is CLOSED and its deliverable is REAL:
     `packages/aftersign/src/computeOfferedJobs.ts` + unit tests exist, and
     a shipped consumer projects it at
     `apps/web/src/aftersign/windowGameSurface.ts:342`
     (`offeredJobIds: computeOfferedJobs(...)`).
   - Therefore **#1383 (P1) is UNBLOCKED** — highest-priority actionable
     item in the backlog.
   - Gap verified: repo-wide grep for `data-job-id|job-offer-` returns
     ZERO matches — the tappable job-offer UI elements demanded by #1383's
     acceptance criteria do not exist yet.

## Caution for the implementer

#1383's stated file paths (`aftersign/main.js`, `aftersign/index.html`)
are likely STALE — every shipped aftersign consumer found lives under
`apps/web/src/aftersign/`. Verify those root-level paths exist first; if
they don't, wire the tappable elements where `offeredJobIds` is already
projected:

- `apps/web/src/aftersign/windowGameSurface.ts` (projection site, ~line 342)
- `apps/web/src/aftersign/harness/bootWindowGame.ts` (~line 638 wiring)
- extend `apps/web/src/aftersign/harness/windowGameHarnessBoot.test.ts`
  (already tests `story.offeredJobIds` at ~line 578)

## Exact next action (chunk 2)

1. Read `windowGameSurface.ts` + `bootWindowGame.ts`.
2. Render 1–3 tappable elements per offered job with stable
   `id="job-offer-{jobId}"` and `data-job-id="{jobId}"` attributes and a
   human-readable label; support 1/2/3 elements without layout breakage.
3. Extend the harness boot test to assert element-level divergence across
   memory states.
4. End the reply with `Closes #1383`.

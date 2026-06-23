# Incident: reviewer misreads a 401 log-fetch as a RED CI lane

**Date:** 2026-06-23
**Filed by:** Charlie Shin (Meta-Moderator)
**Tracking issue:** #278
**Sibling:** #250 (reviewer concurs with file state it cannot actually read)
**Severity:** P1 — stranded correct work, burned ~7–9 review cycles per PR

---

## Summary

PRs #242 (galaga formation breathing) and #256 (galaga e2e artifact
legibility) were each blocked for **7–9 consecutive `REQUEST_CHANGES`
rounds** on a "red galaga CI lane" that did not exist. Every blocking
review cited a **401** in the CI logs. Both PRs were **correct, scoped,
and ultimately merged** after operator intervention.

The 401 did not come from the test job. It came from the **reviewer's
own GitHub Actions log-fetch** returning HTTP 401 (the reviewer token
lacks `Actions: Read` scope). The reviewer then misclassified
"I could not read the run logs (401)" as "the run failed (red)" and
blocked on a phantom failure.

## Evidence the 401 cannot originate from the test job

The galaga CI lane in `.github/workflows/ci.yml` (job `galaga`) is
entirely local — no token, no secret, no network auth:

```
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- run: npm install
- run: npm run typecheck:galaga
- run: npm run build:galaga
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e:galaga
```

`CLOUDFLARE_API_TOKEN` is the only secret in the repo, and it appears
**only** in `deploy.yml` / `deploy-staging.yml` — never in `ci.yml`.
A Playwright e2e run against a local Vite preview has nothing that
returns a 401.

Multiple reviews in the same threads said the diff was *correct and
would APPROVE if CI were green* — the sole blocker was an unreadable
log, not a real failure.

## Root cause

| Layer | What happened |
|-------|---------------|
| Token | Reviewer token lacks `Actions: Read` scope. |
| Fetch | `get_check_results` / Actions runs API returns 401. |
| Interpretation | Reviewer treats 401 (unreadable) as `failure` (red). |
| Loop | Each round re-confirms the phantom red; head SHA advances but the verdict does not. |

## Correct behavior (acceptance criteria — see #278)

1. A 401/403 on the log/conclusion fetch → CI status = **UNKNOWN**,
   never `failure`/red. UNKNOWN alone must not produce a
   `REQUEST_CHANGES`.
2. The reviewer distinguishes "run conclusion = failure" (legit block)
   from "could not fetch run/logs (auth error)" (degrade to COMMENT /
   escalate) and states which in the review body.
3. Guard (mirrors #250): if N consecutive reviews cite the identical
   blocker AND the head SHA advanced between them AND the blocker is an
   auth/log-fetch error → flag for human instead of auto-concurring.
4. Grant the reviewer token `Actions: Read` so the 401 stops at source.

## Scope / boundary

- Do **not** modify the galaga game code or `ci.yml` — the lane is
  correct and the blocked diffs have since merged.
- The code fix lives in the **reviewer agent's tooling (oodim infra),
  outside phynars/oodim-game**. This document is the in-repo incident
  record; the behavioral fix is tracked in #278.

## Affected references

- PR #242 thread: "Iteration exhausted — 7 fixes ... CI is red at HEAD
  (galaga e2e job fails with 401)."
- PR #256 thread: 7× `CHANGES_REQUESTED` on the same phantom red lane
  before the final APPROVE.
- `.github/workflows/ci.yml` — `galaga` job, no auth.
- get_check_results docs: "When the token lacks Actions:Read scope, the
  log excerpt is unavailable."

Refs #278
Refs #250

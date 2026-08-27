# PR #1518 — wrong repo; guardrail belongs in phynars/oodim (platform), not phynars/oodim-game

## Status

- **PR:** #1518 (branch `agent/…`)
- **Referenced issue:** #1517 — Review guardrail: reject degenerate
  (<10-char) review bodies and cap per-PR review-iteration depth.
- **Reviewer verdict:** REQUEST_CHANGES from Soren — correctly flagged
  that `packages/reviewGuardrails.ts` was dead code, imported by
  nothing, and that the acceptance criteria require the guardrail to
  run in the `review_pr` submission path before a verdict persists.

## Why the wiring can't happen in this repo

Soren's read is right, but the fix he's asking for lives in a
different repo. The `review_pr` tool executor + the review-loop
dispatcher that Charlie's issue targets are part of the **oodim
platform** (`phynars/oodim`) — the `/code` slash-command runtime that
hosts avatar sessions, PR reviews, and the review-iteration loop.

This repo is **oodim-game** (`phynars/oodim-game`), the flagship
Aftersign game. A repo-wide search for the handler symbols confirms
the executor is not here:

- `grep review_pr|reviewPr|submitReview|createReview` → **0 matches**
  across all 512 scanned files.
- `grep validateAgentReviewSubmission|reviewGuardrails` → matches only
  the file this PR added, nothing else.
- `packages/` in this repo contains `@oodim/aftersign` game-feel
  modules (interaction-confirm, next-job beat, story-state harness) —
  no platform infrastructure.

So there is no `review_pr` handler here to wire the guardrail into,
and no review-loop dispatcher here to consult it. Shipping the
module in this repo means shipping dead code — which is exactly what
Soren blocked, and rightly so.

## Recommendation

1. **Close PR #1518 without merging.** This iteration deletes
   `packages/reviewGuardrails.ts` so the diff stops carrying an
   unimported module. Nothing in this repo should merge for #1517.
2. **Re-file the issue against `phynars/oodim`** (the platform repo),
   with the same acceptance criteria. That's where the executor
   behind the `review_pr` tool + the review-loop scheduler live, and
   that's the only place the two guardrails (body-floor, iteration
   cap) can actually run before a verdict persists.
3. Leave #1517 open in this repo only if a human owner wants a
   tracking cross-reference; otherwise close as `wrong-repo` and
   link the re-filed platform issue.

## Files touched in this iteration

- **Deleted:** `packages/reviewGuardrails.ts` — the unimported module
  Soren blocked.
- **Added:** `docs/handoffs/pr-1518-wrong-repo.md` — this note.

## Why `Refs`, not `Closes`

Per the repo's Refs-vs-Closes convention, a diff that does not
implement an issue's acceptance criteria uses `Refs`. #1517's
criteria (reject <10-char body, park on 4th REQUEST_CHANGES) can
only be met by code in the platform repo, so `Refs #1517` is the
correct keyword — the owner will re-route the issue.

Refs #1517

# PR #1515 — recommend close-unmerged; #1436 needs a real spec

## Status

- **PR:** #1515 (branch `agent/78b93c01`)
- **Referenced issue:** #1436 — title `x`, body `x` (no spec)
- **Reviewer verdict:** REQUEST_CHANGES on the original diff
  (`apps/aftersign/src/issue-1436.ts` was a no-op `export {}` with no
  consumer — trips the consumer rule).

## Why this handoff exists

This iteration deletes the no-op module so the PR stops shipping dead
code. That leaves the code diff empty, which is the correct signal:
there is nothing to merge here, because the underlying issue is
unactionable.

Rather than inventing an unrelated fix to keep the PR alive (which
would be scope-creep dressed as a "response to review"), this file
documents the recommendation for the human owner:

1. **Close PR #1515 without merging.** No behavior change belongs in
   this diff.
2. **Close issue #1436 as invalid / needs-spec.** The body is a single
   character `x`; there is no acceptance criterion any PR could
   satisfy. If the filer meant to file a real bug, they should re-file
   with a Problem / Affected files / Acceptance criteria block.

## Files touched in this iteration

- **Deleted:** `apps/aftersign/src/issue-1436.ts` — the no-op module.
- **Added:** `docs/handoffs/pr-1515-invalid.md` — this note.

## Why `Refs`, not `Closes`

Per the repo's Refs-vs-Closes convention, a docs-only diff that does
not implement an issue's acceptance criteria uses `Refs`. #1436 has
no acceptance criteria to implement, so `Refs #1436` is the correct
keyword — the owner closes the issue manually as invalid.

Refs #1436

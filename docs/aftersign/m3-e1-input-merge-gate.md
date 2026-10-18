# M3-E1 merge sequencing note

> **Expiry:** delete this file when PR #2265 merges or closes. It exists only to coordinate landing order; it is not a standing input-work spec.

## Why this note exists

PR #2265 is the active owner of the Episode 1 vigil-choice tap surface and the served phone E2E funnel for the ending. While that branch is open, parallel edits to the same files can land first and force a painful rebase on #2265, or introduce a second dispatch path that races the one being reviewed.

This is a sequencing concern, not an input-work directive. No tactile thresholds, hit-target sizes, or gesture timings change as a result of this note.

## Sequencing rule

While #2265 is open, do not land edits to:

- the vigil-choice controls or their click/tap dispatch
- the Episode 1 ending funnel wired to that choice

Any interaction defect found in that area during the window should be reproduced on the served page and filed as a follow-up against #2265 — not fixed in a racing PR.

## When to delete

Delete this file in the same PR that merges or closes #2265. If #2265 is abandoned, delete it then too; the sequencing rule has no meaning without an active owning branch.

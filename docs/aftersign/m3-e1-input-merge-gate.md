# M3-E1 input merge gate

## Scope boundary

PR #2265 adds a dedicated, rendered vigil-choice tap surface and a served phone E2E funnel for the Episode 1 ending. It is the active owner of that interaction path.

Do not land parallel edits to the vigil controls, their click dispatch, or the ending funnel while that PR is open. Review and merge that branch first; any later interaction defect must be reproduced on the served page and scoped as a follow-up.

## Tactile validation boundary

The served E2E in #2265 is valuable routing coverage, but it is not physical-device evidence. Keep tactile thresholds, hit-target sizing, and gesture timing unchanged until a physical-phone reproduction establishes a player-facing regression.

## Merge check

Before merge, confirm the PR's phone-sized served spec uses only rendered controls for the ending path and that its existing checks pass. This gate prevents a second input route or emulator-only feel tweak from racing the M3-E1 branch.

# Handoff: M-LOOP job-offer divergence (Refs #1535)

PR #1534 revision removes the parallel `chooseIoJobOffers` module + test.
The reviewer's rejection was correct: an unwired pure module with a
parallel vocabulary (`tappableActionId`, `AftersignMemoryJobState`,
`id: "blue-seal-safe-run"`) is not acceptance of the M-LOOP story-code
seed.

## What this PR does
- Deletes `apps/web/src/aftersign/ioMemoryJobOffers.ts`
- Deletes `apps/web/src/aftersign/ioMemoryJobOffers.test.ts`
- Files #1535 for the real wiring: extend the existing
  `AftersignJobOfferCopy` shape with `tappableActionId` / `route` /
  `risk` fields, populate the three existing branches (`firstRun` /
  `trusted` / `opened`), and wire `input.choose("take-job-<id>")`
  into `bootWindowGame.ts` so divergence lands at the served surface.

## What this PR does NOT do
The M-LOOP story-code the original PR was trying to seed still needs
to ship — but through the existing contract, not alongside it. That
work is scoped in #1535 and includes:
- Extending `AftersignJobOfferCopy` (existing d.ts + frozen .js rows)
- Wiring branch-specific `input.choose("take-job-<id>")` handlers
- A served-surface consumer test that proves divergence at the
  action-id level across `firstRun` / `trusted` / `opened` branches

## Preserved copy (for #1535 to use verbatim)
- **firstRun** — route: "Take the lit stair. Do not stop under the
  bell rope." · risk: "Low risk. Long route. Io can see most of it
  from the kiosk."
- **trusted** — route: "Cross behind the shuttered pharmacy before
  the bells count twice." · risk: "Short route. Unlit. Better pay
  because Io trusts your hands."
- **opened** — route: "Stay in the amber lamps. Let every sign watch
  the packet." · risk: "Low route risk. Low trust. Io keeps the job
  visible."

Refs #1535

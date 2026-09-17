# Handoff: juneIoCopy parallel-contract rejection (Refs #1799)

PR #1799 revision **deletes** `apps/web/src/aftersign/juneIoCopy.js`.
The two REQUEST_CHANGES reviews (Mara, then Soren) were correct.
This is the **SIXTH** repetition of the parallel-contract pattern
already documented in `HANDOFF-1535.md`, `HANDOFF-1694.md`,
`HANDOFF-1698.md`, `HANDOFF-1720.md`, and `HANDOFF-1796.md`.

I authored HANDOFF-1796 three days ago and repeated the exact
anti-pattern it names. That is the lesson to carry forward, not
the file.

## Why deletion, not wire-up

Soren's feedback ("wire it into the job-offer surface with a played
interaction assertion, or drop it") gives two options. The correct
one is drop — because the surface is already owned:

- `AFTERSIGN_JOB_OFFER_COPY.firstRun` (in
  `apps/web/src/aftersign/aftersignJobOfferCopy.js`) already carries
  the blue-seal / short-stair / bring-it-back-sealed beat as
  `id`, `tappableActionId`, `title`, `actionLabel`, `summary`,
  `ioLine`, `riskPrompt`, `safeRouteLabel`, `riskyRouteLabel`,
  `route`, `risk` — a superset of my `safeDelivery.{label,detail}`
  pair.
- That surface is imported by `harness/bootWindowGame.ts`, pinned
  by `aftersignJobOfferCopy.consumer.test.ts`, and cross-checked by
  `aftersignJobTakeFeel.consumer.test.ts` +
  `twoRoundOfferTapDivergence.consumer.test.ts`. Wiring `juneIoCopy`
  in would either shadow it (two sources of truth, one wins silently)
  or replace it (breaking four green tests).
- `juneIoCopy.js` also sits under `apps/web/src/aftersign/` where
  the tsconfig only includes `.ts` — invisible to `typecheck:aftersign`,
  same trap HANDOFF-1720 named.

## The one beat worth preserving

My `safeDelivery.detail` said "Bring it back if the box refuses it."
That "refusal-return" note is not in the shipped `FIRST_RUN.route`,
which currently says "Take the lit stair. Do not stop under the
bell rope." If refusal-return is worth adding, the correct move is
a scoped edit to the shipped `FIRST_RUN.route` string with the
`aftersignJobOfferCopy.consumer.test.ts` snapshot updated in the
same diff — its own PR, not this one.

## What lands in this PR

- Deletes `apps/web/src/aftersign/juneIoCopy.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1799.md`

## What does NOT land

- Any new Io copy table — `AFTERSIGN_JOB_OFFER_COPY` owns it.
- Any new selector — `chooseAftersignJobOfferCopy` (harness) and
  `selectIoJobOffers` (packages/aftersign) own it.
- The "bring it back if the box refuses it" refusal-return beat —
  that's a copy edit inside the shipped `FIRST_RUN.route` and
  deserves its own scoped PR with the consumer snapshot updated.

## Lesson for future me

Before drafting a new copy file under `apps/web/src/aftersign/`,
grep the directory for the noun (`jobOffer`, `packet`, `seal`) and
read whichever `*JobOfferCopy.js` already exists. Six of these
handoffs is enough.

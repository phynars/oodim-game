# Handoff: ioJobOfferCopy parallel-contract rejection (Refs #1796)

PR #1796 revision **deletes** `apps/web/src/aftersign/ioJobOfferCopy.js`.
The two REQUEST_CHANGES reviews (Mara, then Soren) were correct, and
this is the **FIFTH** repetition of the parallel-contract pattern
already documented in `HANDOFF-1535.md`, `HANDOFF-1694.md`,
`HANDOFF-1698.md`, and `HANDOFF-1720.md`. Reading those before opening
a sixth is not optional.

## Why deletion, not wire-up

The reviewer feedback ("wire the selected offer into the runnable
kiosk surface") sounds like the fix is to add an importer. It is not.
There is nothing new to wire, because the surface it asks for
**already ships** with a different name — my file was a second copy
of it.

Three failures compound in the one file:

1. **The shipped surface already owns this beat.** Io's memory-
   branched job-offer copy lives at
   `apps/web/src/aftersign/aftersignJobOfferCopy.js`:

   ```js
   export const AFTERSIGN_JOB_OFFER_COPY = Object.freeze({
     firstRun: FIRST_RUN,   // fresh boot
     trusted:  TRUSTED,     // sealed return
     opened:   OPENED,      // opened packet
   });
   export function chooseAftersignJobOfferCopy(memory) { ... }
   ```

   Each row carries `id`, `tappableActionId`, `title`, `actionLabel`,
   `summary`, `ioLine`, `riskPrompt`, `safeRouteLabel`,
   `riskyRouteLabel`, `route`, `risk` — a superset of the fields my
   `IO_JOB_OFFERS` proposed. The branch key is packet outcome
   (fresh / sealed / opened), identical to what my `getIoJobOffer`
   was branching on.

   That surface is imported by `harness/bootWindowGame.ts`, pinned by
   `aftersignJobOfferCopy.consumer.test.ts`, cross-checked by
   `aftersignJobTakeFeel.consumer.test.ts` and
   `twoRoundOfferTapDivergence.consumer.test.ts`, and the aftersign
   packages/aftersign side has `selectIoJobOffers` +
   `ioJobOffersDiverge` for the two-round divergence contract
   (`aftersignMloopDivergence.contract.test.ts`).

2. **Wiring the parallel module would SHADOW, not add.** `IO_JOB_OFFERS`
   (my file) and `AFTERSIGN_JOB_OFFER_COPY` (shipped) are the same
   table with different names and a subset of fields. Importing
   `getIoJobOffer` into the kiosk render would either replace
   `chooseAftersignJobOfferCopy` (breaking the four consumer tests and
   the shipped copy) or duplicate its call (two sources of truth, one
   winning silently). This is exactly the drift HANDOFF-1535.md called
   out and deleted.

3. **Invisible to typecheck.** `ioJobOfferCopy.js` lives under
   `apps/web/src/aftersign/` but the aftersign tsconfig only includes
   `.ts` (see the note in HANDOFF-1720.md — no `allowJs` on either
   scope). Even the parallel-vocabulary risk aside, the file could
   not have been caught by `typecheck:aftersign`, and my proposed
   `getIoJobOffer` had no `.d.ts` companion. The shipped
   `aftersignJobOfferCopy.js` is protected by `aftersignJobOfferCopy.d.ts`.

## The one distinction worth naming

My `IO_JOB_OFFERS.sealedReturn.detail` says "Short route. The bell is
already listening." — a specific beat (the bell as a live listener on
the sealed-return branch) that the shipped `TRUSTED.route` does not
name. If that beat is worth adding, the correct move is to extend the
shipped `TRUSTED` row's `route` / `risk` copy in-place, gated by the
existing consumer test — not to add a parallel module. That's a
scoped, one-file edit and does not belong in this PR.

## Sprint-constraint check

Founder note: "code only until the vertical slice runs — no new
`docs/flagship/*.md`". This handoff lives at
`apps/web/src/aftersign/HANDOFF-1796.md`, matching the location of
the four prior parallel-contract handoffs.

## What lands in this PR

- Deletes `apps/web/src/aftersign/ioJobOfferCopy.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1796.md`

## What does NOT land

- Any new job-offer table for Io — `AFTERSIGN_JOB_OFFER_COPY` owns it.
- Any new selector for the offer branches — `chooseAftersignJobOfferCopy`
  (harness side) and `selectIoJobOffers` (aftersign package side) own it.
- The "bell is already listening" beat on the sealed-return branch —
  that's a copy edit inside the shipped `TRUSTED` row and deserves
  its own scoped PR with the consumer test updated in the same diff.

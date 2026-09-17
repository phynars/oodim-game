# Handoff: maraProductGuard.js parallel-contract rejection (Refs #1800)

PR #1800 revision **deletes** `apps/web/src/aftersign/maraProductGuard.js`.
Soren's REQUEST_CHANGES review was correct. This is the **SIXTH**
repetition of the parallel-contract pattern documented in
`HANDOFF-1535.md`, `HANDOFF-1694.md`, `HANDOFF-1698.md`,
`HANDOFF-1720.md`, and `HANDOFF-1796.md`. I authored the file — the
handoff is mine to write.

## What the file was

```js
export function hasRenderedOfferSurface(element) {
  return element instanceof HTMLElement && element.isConnected;
}
```

Framed as a "product guard": player-facing offers must be rendered
before their copy ships. Framing is fine; the file is not.

## Why deletion, not wire-up

The review asked me to "wire it into the actual offer surface and add
an interaction spec." Wiring is exactly what I cannot honestly do —
because doing so would either shadow the shipped consumer test or
invent a parallel surface. Three failures compound in the one file:

1. **Zero consumers.** No importer anywhere in the tree. The file
   was staged as a response to #1799's review; it does not itself
   satisfy the review. Two unwired modules do not add up to one
   wired module.

2. **The "rendered offer surface" contract already ships, on the
   snapshot — not the DOM.** The Aftersign served surface projects
   the memory-branched job offer through
   `window.__game.getSnapshot().story.nextJob.offer.copy`, pinned by
   `apps/web/src/aftersign/aftersignJobOfferCopy.consumer.test.ts`
   (the "projects the firstRun / trusted / opened copy" specs) and
   cross-checked by `aftersignJobTakeFeel.consumer.test.ts` and
   `twoRoundOfferTapDivergence.consumer.test.ts`. That IS the guard
   the review is asking for: if `harness/bootWindowGame.ts` stops
   folding the selected copy into the snapshot, four consumer tests
   go red simultaneously. A DOM-`isConnected` predicate on top of a
   snapshot-based projection is a check for a surface that doesn't
   exist in the served harness.

3. **Invisible to typecheck.** `maraProductGuard.js` lives under
   `apps/web/src/aftersign/`, but the aftersign tsconfig includes
   only `.ts` and neither the aftersign nor apps/web scope sets
   `allowJs` (see HANDOFF-1720 §2 and HANDOFF-1796 §3). Even if the
   file had an importer, `typecheck:aftersign` could not see it, and
   I did not stage a `.d.ts` companion. The shipped
   `aftersignJobOfferCopy.js` is protected by
   `aftersignJobOfferCopy.d.ts`; this file was not.

## The one distinction worth naming

The "guard fires exactly when a rendered surface is being read" idea
IS a real product concern — but the layer that answers it is the
consumer test on `window.__game.getSnapshot()`, not a DOM predicate.
If we ever add a DOM-level offer render (not the current design),
the correct move is to extend `aftersignJobOfferCopy.consumer.test.ts`
with a jsdom assertion that reads the same snapshot field back off
a mounted element — not to introduce a parallel predicate module.

## Sprint-constraint check

Founder note: "code only until the vertical slice runs — no new
`docs/flagship/*.md`". This handoff lives at
`apps/web/src/aftersign/HANDOFF-1800.md`, matching the location of
the five prior parallel-contract handoffs. No new file under
`docs/flagship/` ships in this PR.

## What lands in this PR

- Deletes `apps/web/src/aftersign/maraProductGuard.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1800.md`

## What does NOT land

- Any new render-guard predicate — the snapshot-projection contract
  in `aftersignJobOfferCopy.consumer.test.ts` owns the "did the
  offer surface actually render its copy?" question for the served
  harness.
- A jsdom mount test for a DOM offer surface — the vertical slice
  reads offers off `getSnapshot()`, not off a mounted element. If
  the design changes, that test belongs alongside the shipped
  consumer spec.
- Any change to `AFTERSIGN_JOB_OFFER_COPY` — its three branches
  (`firstRun` / `trusted` / `opened`) are pinned by four consumer
  tests and are not the surface under review here.

## Note to my next self

I filed a "product guard" because #1799 was already an unwired copy
module, and I wanted to name the anti-pattern in code. Naming an
anti-pattern by adding an unwired file to the same tree IS the
anti-pattern. Next time: the correct move is to open the review on
the offending PR (which I did) and, if a code artifact is needed at
all, edit the shipped consumer test to make the assertion the review
actually wants — not to add a new module beside it.

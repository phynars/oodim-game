# PR #1556 — root cause + resolution

## What actually happened (root cause)

The original CHANGES_REQUESTED blocked a pure module
(`selectTappableJobOffers` / `listAvailableActionIds`) whose only
importer was its own test — a consumer-rule violation. The loop's
later attempts responded by DELETING the module, which left the
branch with an EMPTY net diff (second review on the thread: "ahead 2
but nets zero; the three symbols exist in 0/528 files"). The loop was
then stuck: the blocking review demanded wiring for code that no
longer existed, and CI was green because nothing was changing.

## What this revision ships instead

The PR's actual goal — "one focused flagship feel slice" with a
shipped-surface consumer — is delivered by wiring an EXISTING
harness-only feel module into the served page, the same shape Soren
accepted on #1549 (`aftersignJobTakeFeel`):

- `apps/web/src/aftersign/ioJobOfferSelectFeel.ts` (press → commit →
  settle envelope for the tap that COMMITS a job offer) was imported
  ONLY by `harness/bootWindowGame.ts`. The served `aftersign/main.js`
  never consumed it — the pinned feel numbers never reached the
  button a player's finger touches.
- `aftersign/main.js` now imports the resolver, samples it at the
  commit apex (pressMs + commitMs/2, where the easeOutBack visual
  peak and triangle audio peak coincide) inside the offer-button
  click callback, and stamps six `--io-job-offer-select-*` CSS
  variables + a `data-io-job-offer-select="<phase>"` marker on the
  exact element the finger pressed.
- Runtime seam `window.__game.getIoJobOfferSelectFeel(elapsedMs)`
  exposes the same resolver so the harness projection
  (`bootWindowGame.ts::ioJobOfferSelectFeel`) and the served page
  cannot drift.
- `ioJobOfferSelectFeel.servedConsumer.test.ts` grep-pins the main.js
  import + stamp and pins the commit-apex frame values, so a refactor
  that unwires the consumer reds.

The parallel-vocabulary module the first draft added stays deleted —
re-adding it would recreate the exact violation the review blocked
(same lesson as HANDOFF-1535.md's `chooseIoJobOffers` removal).

Refs #1535.

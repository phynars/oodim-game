# AFTERSIGN architecture

This document is the product-level map for the active flagship. It describes
current ownership boundaries and verification contracts, rather than proposing
new systems. Studio-level context lives in
[`docs/plan/architecture/README.md`](../../docs/plan/architecture/README.md);
product intent and mandate live in
[`docs/flagship/BRIEF.md`](../../docs/flagship/BRIEF.md) and
[`docs/flagship/concept.md`](../../docs/flagship/concept.md). If this doc and
the brief ever disagree, the brief wins — fix this doc to match the code.

## Served surface

`aftersign/index.html` is the served page entry point
(`game.oodim.com/aftersign/`; locally, vite preview). It loads module scripts
in this order:

1. `./jobOfferPressing.js`
2. `./packetOfferPressing.js`
3. `./routeChoicePressing.js`
4. `./main.js` — the game runtime

A player reaches story and game actions through rendered controls on that
served page. Product changes belong in the module that owns the slice;
`index.html` is the document shell, not a general-purpose gameplay module.

The served-page contracts (`aftersign/routeChoicePressServedContract.ts`,
`aftersign/pure-runner.ts`, `aftersign/m-loop-playtest.acceptance.mjs`)
inspect these script tags directly. Renaming or reordering an entry script
means updating those contracts in the same PR.

## Client contracts

`aftersign/src/` contains flagship client-side modules: story and interaction
contracts, presentation-facing state, and the code consumed by the served
surface. Canonical recognition copy lives at
`aftersign/src/ioRecognitionDialogue.ts` and is pinned by the pure-runner;
any served render that speaks a recognition line must sort to that table.

`packages/aftersign/` contains shared AFTERSIGN contracts used across runtime
boundaries. It is not a second served application; the page remains rooted at
`aftersign/index.html` and `aftersign/main.js`.

## Durable memory boundary

Player identity, save/load state, and NPC memory are authoritative beyond the
browser. The client requests and renders those results; durable persistence is
owned by the backend boundary rather than browser-local state. This separation
is what lets returning-player recognition and saved outcomes survive a new
session.

`aftersign/src/story-state.js` provides an in-memory seam for client-side
story-state consumers and tests; it is not player persistence. Browser-local
storage is not a player-save boundary. Returning-player state and recovery
must be read from the durable backend authority.

## Player-driven verification

Flagship browser acceptance tests live in `aftersign/e2e/`. They play the
served page using visible rendered controls with player-like pointer, touch,
or keyboard input. Phone-viewport specs live in the same folder.

`window.__game` is an assertion surface only: tests may read its published
state to verify an outcome — story beats, save/load round-trips, NPC-memory
recognition, feel envelopes — but must not call it (or another harness hook)
to cause a player action. A state transition reached only through a harness
input is not served-page acceptance evidence.

Red/green polarity lanes use `FLAGSHIP_BREAK_MODE` to prove the guards catch
deliberate breaks; the post-merge `main-e2e` lane re-plays the served page
against main after every merge.

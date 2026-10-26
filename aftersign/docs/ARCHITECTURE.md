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

This order is a served-page contract: the pressing modules precede the runtime
entry point. Keep it stable unless the served-page contracts are updated in the
same change. This document does not establish a runtime failure mode for a
different order.

A player reaches story and game actions through rendered controls on that
served page. Product changes belong in the module that owns the slice;
`index.html` is the document shell, not a general-purpose gameplay module.

The served-page contracts (`aftersign/routeChoicePressServedContract.ts`,
`aftersign/pure-runner.ts`, `aftersign/m-loop-playtest.acceptance.mjs`)
inspect these script tags directly. Renaming or reordering an entry script
means updating those contracts in the same PR.

## Controller ownership

Interaction controllers own the temporary physical state of the specific
rendered control they attach to. `jobOfferPressing.js` exports
`attachJobOfferPressing(button)`: its input is a rendered
`button[data-aftersign-job-take]`, its state is the button's attached/pressing
lifecycle, and its render output is the press marker and visual compression on
that button. `packetOfferPressing.js` and `routeChoicePressing.js` have the
same boundary for packet-offer and route-choice controls respectively: they
consume their own rendered button surfaces, retain only press lifecycle state,
and render the pressed presentation back onto those surfaces.

`main.js` imports and composes the presentation controllers
`createCameraController`, `createDialogueController`, and
`createMobileInputController`. Their documented boundaries are camera,
dialogue, and mobile-input presentation respectively; this architecture map
does not restate their internal input/output shapes. `main.js` retains boot
and global runtime composition.

`aftersign/main.js` retains served audio behavior, persistence integration,
and global runtime composition. `src/packetPressFeedbackRenderer.js` owns the
packet-button press-feedback render slice; `main.js` injects its button,
feedback state transitions, tactile cue, and browser adapters. That boundary
does not transfer controller ownership back into `index.html`.

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

`window.__game` is a stable e2e assertion contract, not a gameplay input API.
Tests may read its published state to verify outcomes — story beats, save/load
round-trips, NPC-memory recognition, feel envelopes, and
`_runtime.audio` unlock/ambient/cue state — but must not call it (or another
harness hook) to cause a player action. A state transition reached only through
a harness input is not served-page acceptance evidence.

## Audio runtime

The existing `aftersign/main.js` runtime owns served WebAudio. Its visible
interactions use the gesture-gated `enableAudio()` path before the synthesized
rainline ambient bed and `music-layer.js`'s repeating synthesized triangle-note
music can start. The phone-visible `#musicButton` mutes only the music gain;
interaction cues retain their audio path. `_runtime.audio` is the read-only
verification boundary: browser tests must tap rendered controls, then may
inspect unlock, ambient, music, and cue state. No external audio assets are
required.

Red/green polarity lanes use `FLAGSHIP_BREAK_MODE` to prove the guards catch
deliberate breaks; the post-merge `main-e2e` lane re-plays the served page
against main after every merge.

## Synthesized music layer

`aftersign/audio.js` starts a low-volume WebAudio triangle-note loop alongside the rainline ambient bed after the player taps the visible **Wake kiosk sound** control. `#musicButton` remains hidden until that gesture unlocks audio, then lets the player mute or unmute only the music gain; interaction cues retain their existing audio path. The existing published `window.__game._runtime.audio` state includes `ambientStarted`, `musicStarted`, `musicMuted`, and `musicState` (`idle` → `playing` ⇄ `muted`, written by `aftersign/audio.js`) for e2e outcome assertions. `aftersign/e2e/aftersign-audio-runtime.playtest.spec.ts` uses phone viewport taps on those visible controls and does not use harness input to cause actions.

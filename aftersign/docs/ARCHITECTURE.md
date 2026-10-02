# AFTERSIGN architecture

This document is the product-level map for the active flagship. It describes
current ownership boundaries and verification contracts, rather than proposing
new systems.

## Served surface

`aftersign/index.html` is the served page entry point. It imports
`aftersign/main.js`, which composes the visible game surface and connects the
page to the flagship's modular contracts.

A player reaches story and game actions through rendered controls on that
served page. Product changes belong in the module that owns the slice;
`index.html` is the document shell, not a general-purpose gameplay module.

## Client contracts

`aftersign/src/` contains flagship client-side modules: story and interaction
contracts, presentation-facing state, and the code consumed by the served
surface.

`packages/aftersign/` contains shared AFTERSIGN contracts used across runtime
boundaries. It is not a second served application; the page remains rooted at
`aftersign/index.html` and `aftersign/main.js`.

## Durable memory boundary

Player identity, save/load state, and NPC memory are authoritative beyond the
browser. The client requests and renders those results; durable persistence is
owned by the backend boundary rather than browser-local state. This separation
is what lets returning-player recognition and saved outcomes survive a new
session.

## Player-driven verification

Flagship browser acceptance tests live in `aftersign/e2e/`. They play the
served page using visible rendered controls with player-like pointer, touch,
or keyboard input.

`window.__game` is an assertion surface only: tests may read its published
state to verify an outcome, but must not call it (or another harness hook) to
cause a player action. A state transition reached only through a harness input
is not served-page acceptance evidence.

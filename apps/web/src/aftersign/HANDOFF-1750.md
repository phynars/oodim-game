# Handoff: aftersign-return-consequence-copy parallel-contract rejection (Refs #1750)

PR #1750 revision **deletes** `apps/web/src/aftersign/aftersignReturnConsequenceCopy.js`.
Soren's REQUEST_CHANGES review was correct, and this is the FIFTH
repetition of the parallel-contract pattern already documented in
`HANDOFF-1535.md`, `HANDOFF-1694.md`, `HANDOFF-1698.md`, and
`HANDOFF-1720.md`.

## Why deletion, not wire-up

Three failures compound in the one file — the same three every time.

1. **Zero consumers.** Grep across the repo for
   `chooseAftersignReturnConsequenceCopy` returns exactly one match:
   the export line in the module itself. No caller in
   `aftersign/main.js`, no consumer under `apps/web/src/aftersign/`,
   no spec, no test.

2. **Invisible to typecheck.** The file landed as `.js` under
   `apps/web/src/aftersign/`, but every other copy module in that
   directory is `.ts` (e.g. `ioFirstSceneDialogue.ts`,
   `packetChoiceFeel.ts`). Per `HANDOFF-1694` and `HANDOFF-1698`,
   `aftersign/tsconfig.json` has no `allowJs` and `apps/web`'s
   include is `["../apps/web/src/aftersign/**/*.ts"]`. A `.js` sibling
   of the shipped `.ts` copy files is not seen by
   `typecheck:aftersign` at all. Even if it had a consumer, it
   couldn't be safely refactored.

3. **Parallel vocabulary for a beat that already ships.** The Io
   return-consequence beat is not a missing surface — it is the
   `sealedReturn` / `openedReturn` entries in
   `apps/web/src/aftersign/ioFirstSceneDialogue.ts`, selected by
   `getAftersignIoPacketReturnLine(packetOutcome)` from the committed
   `AftersignPacketOutcome` in `verticalSliceRuntimeState`. The
   deleted module proposed a DIFFERENT vocabulary:

   - Its `outcome` argument was `"opened" | "withheld" | <default>`.
     The runtime has no `"withheld"` outcome — the committed alias
     is `"sealed" | "opened"`. `"withheld"` is a fiction from
     outside the state machine.
   - It returned `{ line, action }` — a shape the dialogue renderer
     doesn't consume. The shipped shape is `AftersignIoFirstSceneLine`
     with `id`, `text`, `intent`, `memoryKey`.
   - It carried no `memoryKey`, so even if wired, the recognition-feel
     layer that gates `io_return_packet_sealed` /
     `io_return_packet_opened` would have nothing to remember by.

   Wiring it would either shadow the shipped `sealedReturn`/`openedReturn`
   beats (two sources of truth for the same line) or invent a third
   outcome branch (`withheld`) that no state ever writes. Both are
   drift.

## The one distinction worth naming

The deleted module encoded a caller-provided `nextAction` string
("come back for another run" by default) so the payoff line could
name the next runtime affordance without hardcoding it. That is a
real concern — Io's payoff should point somewhere the player can
actually tap — but it belongs at the INTERACTION layer that
renders `sealedReturn` / `openedReturn`, not in a parallel dialogue
module. Answering it means adding a `nextAction` seam to the
consumer (whatever renders the return beat), OR extending
`AftersignIoFirstSceneLine` with an optional `nextAction`
identifier that maps to a tappable id at the surface layer. Either
path anchors on the shipped module and its tests, not a fresh
parallel file.

## Sprint-constraint check (Refs founder note)

The founder's sprint constraint reads "code only until the vertical
slice runs — no new `docs/flagship/*.md`". This handoff lives at
`apps/web/src/aftersign/HANDOFF-1750.md`, not `docs/flagship/`,
matching the four prior parallel-contract rejections
(`HANDOFF-1535/1694/1698/1720.md`). It exists so a re-reviewer
can see immediately why this PR closed with a deletion and what
the actual runtime seam looks like.

## What lands in this PR

- Deletes `apps/web/src/aftersign/aftersignReturnConsequenceCopy.js`
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1750.md`

## What does NOT land

- Any new return-consequence line for Io — `sealedReturn` and
  `openedReturn` in `AFTERSIGN_IO_FIRST_SCENE_DIALOGUE` already own it.
- Any `"withheld"` outcome branch — the runtime alias is
  `"sealed" | "opened"`; a third option needs to be added to
  `verticalSliceRuntimeState` FIRST, in its own scoped PR, before
  any dialogue module can speak it.
- Any `nextAction` copy seam — that's an interaction-layer question
  (which id becomes tappable next), not a dialogue-module question,
  and deserves its own scoped PR against the surface that renders
  the return beat.

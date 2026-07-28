# Triage: #863 Orra phone-viewport playthrough spec is structurally blocked

Date: 2026-07-27 · Session: meta-moderator chunk 4/4 · Commit: `8aed8b5`

## Verdict

The chunk-3 spec `aftersign/e2e/orra-phone-viewport-playthrough.spec.ts`
(Refs #863) cannot go green by fixing choice ids. It asserts a game surface
that does not exist yet. `agent-unroutable` stays on #863 until the wiring
lands.

## Evidence

1. **Orra is pure-logic only.** `aftersign/src/orraRecognitionMemory.ts`
   exports the fact builder (`buildOrraRecognitionMemoryFact`), the line
   selector (`orraRecognitionLineForMemory`), and
   `ORRA_RETURN_LINE_BY_ACTION` (`lit` → `orra_return_lit_vigil`,
   `spared` → `orra_return_spared_vigil`). Its pure contract spec
   (`orra-recognition-memory-contract.spec.ts`) is wired into both
   Playwright lane lists already.
2. **The playable game never imports it.** `aftersign/index.html` contains
   zero Orra references — no `npcs.orra` state, no
   `window.__game.story.orraMemoryBeat`, no Orra scene or choices. The only
   NPC surface is `npcs.io` (memory, lastLine, lastLineMemoryRefs).
3. **The guessed choice ids do not exist.** `light-vigil`, `spare-vigil`,
   and `return-to-orra` appear nowhere in `aftersign/**`.

## Config corrections (for whoever wires the beat)

The prior hand-off's step (2) was wrong; do NOT execute it:

- `aftersign/playwright.config.ts` ~L43 is a **`testIgnore`** list (pure
  specs excluded from the browser lane). Adding a new `{ page }` spec there
  would REMOVE it from CI. New browser specs need **no config edit** —
  `testDir: "e2e"` discovers them by default.
- `aftersign/playwright.pure.config.ts` `testMatch` must NEVER include a
  `{ page }` spec — that lane has no browser project and no webServer.

## Unblock path

1. Wire the Orra beat into `aftersign/index.html`:
   - import `./src/orraRecognitionMemory.js`;
   - add `npcs.orra` state (memory fact + lastLineId), persisted alongside
     but structurally ISOLATED from Io's (distinct key + field, per #863
     Scope);
   - expose `story.orraMemoryBeat` on `window.__game`;
   - add the two deliberate-action choices and return-line selection via
     `orraRecognitionLineForMemory`.
2. Correct the playthrough spec to the REAL choice ids and surface shape.
3. Then #863's Closes gate (recognition branch, first-contact branch,
   Io non-regression, three red modes, phone viewport) becomes reachable.

Cross-reference: triage comment posted on #863
(issuecomment-5104124883).

Refs #863

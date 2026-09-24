# Playtest contract audit

## Finding

`aftersign/e2e/flagship-phase2-input-delivery-contract.spec.ts` drives story choices through `window.__game!.input.choose(...)` (lines 39 and 64). This is appropriate for a contract test, but it is not player-driven acceptance evidence under the flagship brief.

## Boundary

Player-facing milestone specs must tap visible rendered controls. Harness-hook input belongs to contract coverage and must remain clearly separated from playtest evidence.

## Follow-up

Track an automated guard that prevents a spec using `window.__game.input.*` from being presented as a `.playtest.spec.ts` acceptance test.

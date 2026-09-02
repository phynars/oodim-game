# NPC-memory round-trip coverage follow-up

Tracked in [#1591](https://github.com/phynars/oodim-game/issues/1591).

The current flagship e2e suite documents a deferred NPC-memory round-trip contract migration, and the explicit red/green gate configuration has that check disabled. The follow-up restores an enabled regression guard against the live served-page memory/state contract.

## Scope

- Update `aftersign/e2e/npc-memory-roundtrip.spec.ts` to remove its temporary deferred coverage state once the live contract is supported.
- Enable `npc-memory-roundtrip` in `aftersign/e2e/redgreen-gates.json`.
- Keep NPC dialogue, persistence semantics, and story content unchanged.

## Completion evidence

The enabled green lane executes the round-trip test, assertions target the live served-page state shape, and the flagship e2e lane passes with the guard active.

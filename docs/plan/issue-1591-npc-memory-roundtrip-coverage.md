# NPC-memory round-trip coverage follow-up

Tracked in [#1591](https://github.com/phynars/oodim-game/issues/1591).

The current flagship e2e suite documents a deferred NPC-memory round-trip contract migration, and the explicit red/green gate configuration has that check disabled. The follow-up restores an enabled regression guard against the live served-page memory/state contract.

## Scope

- Update `aftersign/e2e/npc-memory-roundtrip.spec.ts` to remove its temporary deferred coverage state (drop the FLAGSHIP_BREAK_MODE=drop-memory `test.skip` and the workflow-marker header comment) so the spec runs in the default `test:e2e:aftersign` lane.
- Flip `npc-memory.green` to `"live"` in `aftersign/redgreen.config.json` — the workflow's actual source of truth (`.github/workflows/redgreen.yml`). Leave `npc-memory.red` retired: per that config's own note (2026-08-26, #1419), the `drop-memory` break-mode implementation fell out of the runtime, so a live red lane would trip the workflow's broken-polarity fail-loud check.
- Delete the stale `aftersign/e2e/redgreen-gates.json` — it was scaffolded under #727 but the paired workflow rewrite never landed, so nothing consumes it.
- Keep NPC dialogue, persistence semantics, and story content unchanged.

## Completion evidence

The enabled green lane executes the round-trip test, assertions target the live served-page state shape, and the flagship e2e lane passes with the guard active.

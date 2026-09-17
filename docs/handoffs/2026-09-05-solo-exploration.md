# Solo exploration — 2026-09-05

## Finding

`aftersign/e2e/durable-save-load.spec.ts` skips its durable save/load contract unless `FLAGSHIP_BREAK_MODE=local-only-save` is set. The flagship architecture describes durable save/load round-trips as part of the active verification contract and says the post-merge lane re-proves main. This leaves the normal lane without that coverage.

A GitHub issue accompanies this note.

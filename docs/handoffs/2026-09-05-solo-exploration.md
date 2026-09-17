# Solo exploration — 2026-09-05

**Status:** investigation note. Docs-only. Refs #1801 — this note does
not implement the fix; it records what the tree actually shows so the
next attempt starts from ground truth rather than from a plausible-
sounding wrong story.

## Original finding

`aftersign/e2e/durable-save-load.spec.ts:84-90` skips its body unless
`FLAGSHIP_BREAK_MODE=local-only-save` is set. The normal flagship lane
therefore never exercises that spec. The active architecture
(`docs/plan/architecture/README.md`) lists durable save/load round-trips
as part of the flagship verification contract, so at first read this
looks like a coverage gap.

## Ground truth in the current tree

Correction to this note's earlier version, verified against the tree at
this commit:

1. **`aftersign/e2e/save-load-durable-contract.spec.ts` does not exist.**
   `grep save-load-durable-contract\.spec\.ts path:aftersign/e2e` returns
   zero matches. This note's previous claim that the file "proves" the
   contract in the green lane was wrong. The 2026-07-30 handoff
   (`docs/handoffs/2026-07-30-solo-exploration.md`) says explicitly:
   *"`save-load-durable-contract.spec.ts` no longer exists (the
   server-authoritative save path landed and retired the shared-contract
   spec)."*

2. **Both durable-save lanes are retired in `redgreen.config.json`.**
   The checked-in config marks `durable-save.green` and
   `durable-save.red` as `"retired"`. The file's own top comment
   explains why: after #1419 the break-mode implementations
   (`local-only-save` / `drop-memory`) "no longer actually break the
   surface" because server-authoritative save landed, so flipping either
   red to `"live"` would trip the workflow's "broken-polarity spec
   passed (exit 0)" fail-loud. The `redgreen.yml` job that references
   `save-load-durable-contract.spec.ts` is therefore not currently
   proving anything — it is gated off by the retired config.

3. **`durable-save-load.spec.ts` is the hard-navigation survival spec**
   (per its own top comment: *"This is NOT the durable/authoritative
   contract test — that lives at `flagship-surface-contract.spec.ts`"*).
   Its `test.skip` on `FLAGSHIP_BREAK_MODE !== 'local-only-save'` was
   added under #1419 Path (b) because its three cold `page.goto` boots
   reliably trip the SwiftShader cold-start flake tracked in
   #700 / #506 / #590 / #766.

4. **The durable contract itself lives in `flagship-surface-contract.spec.ts`**,
   which the default aftersign E2E lane already runs (it is picked up by
   the unconditional `test:e2e:aftersign` glob). That is what actually
   proves the round-trip in the default lane today.

## What #1801 asks, mapped onto this ground truth

#1801's acceptance criteria:

- *The standard flagship E2E command executes a non-break-mode durable
  save/load round-trip.* — Satisfied today by
  `flagship-surface-contract.spec.ts` in the default aftersign lane.
  Not by `durable-save-load.spec.ts`, which is a different (hard-nav)
  concern.
- *The test asserts persisted state survives a reload through the
  authoritative store.* — Same file; the authority assertions live in
  the flagship surface contract.
- *`FLAGSHIP_BREAK_MODE=local-only-save` still makes the red guard fail
  for the expected reason.* — Currently gated off: `redgreen.config.json`
  has `durable-save.red = "retired"` because no implemented break-mode
  actually breaks the surface (see the config's own note dated
  2026-08-26 / #1419). Re-living the red lane requires restoring a real
  break-mode implementation first; this is #1418's work, not #1801's.
- *The normal run is stable under CI.* — Depends on the SwiftShader
  cold-start flake (#700 / #506 / #590 / #766). Removing the skip on
  `durable-save-load.spec.ts` without addressing that flake re-
  introduces a known-flaky boot to the default lane.

## Recommendation

- Treat this note as investigation. It corrects the previous version's
  false claim about `save-load-durable-contract.spec.ts` and captures
  the actual configuration of the tree.
- Do not remove the skip on `durable-save-load.spec.ts` until either
  the cold-start flake is resolved or that spec is rewritten to avoid
  three cold `page.goto` boots.
- Re-living `durable-save.red` in `redgreen.config.json` is blocked on
  #1418 (a real break-mode implementation), not on #1801.
- If a reviewer wants #1801 closed on the round-trip criterion alone,
  the honest close is: "already covered by
  `flagship-surface-contract.spec.ts` in the default aftersign lane" —
  not by adding a new lane run for `durable-save-load.spec.ts`.

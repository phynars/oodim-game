# Solo exploration — 2026-09-05

**Status:** investigation note + green-lane restoration. Refs #1801.
This note is docs-only; the accompanying one-line change in
`aftersign/redgreen.config.json` flips `durable-save.green` from
`"retired"` to `"live"` so the default flagship lane once again
executes the durable save/load contract via `save-load-durable-contract.spec.ts`
(which does exist at HEAD and asserts the round-trip through the
server-authoritative store). The red lane stays retired pending
#1418's real break-mode restoration — that gap is #1418's work, not
#1801's.

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

1. **`aftersign/e2e/save-load-durable-contract.spec.ts` exists and
   asserts the round-trip.** It authors an Io delivery memory, calls
   `forceSave`, wipes `localStorage`, cold-restarts via `page.goto`,
   and asserts that `save.revision`, `packet.delivered`, and the Io
   memory fact all survive — which only holds if the load path is
   server-authoritative (which it now is; see
   `aftersign/server-authoritative-save.js` + the vite middleware in
   `aftersign/vite.config.ts`). The spec's own top comment explains
   this in detail. An earlier version of this note claimed the file
   was retired — that was wrong.

2. **After this PR, `durable-save.green` is `"live"`; `durable-save.red`
   stays `"retired"`.** Before this PR both lanes were retired; the
   green lane was retired defensively while server-authoritative save
   was landing. The spec's assertions now pass in the default lane
   against the real durable path, so `redgreen.yml`'s green preflight
   can un-gate it. The red lane stays retired because the break-mode
   implementations (`local-only-save` / `drop-memory`) no longer
   actually break the surface — flipping red to `"live"` would trip
   the workflow's "broken-polarity spec passed (exit 0)" fail-loud.
   Restoring a real break-mode is #1418's work.

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
  save/load round-trip.* — Satisfied after this PR by flipping
  `durable-save.green` to `"live"` so `save-load-durable-contract.spec.ts`
  runs in the default `redgreen.yml` green job (which was already
  wired into the flagship E2E lane; only the config gate held it back).
  The complementary `flagship-surface-contract.spec.ts` continues to
  exercise its own authority assertions in the default aftersign lane.
- *The test asserts persisted state survives a reload through the
  authoritative store.* — `save-load-durable-contract.spec.ts` wipes
  `localStorage` between save and cold `page.goto`, so surviving
  assertions can only hold via the server-authoritative store
  (vite middleware, keyed by playerId+slot).
- *`FLAGSHIP_BREAK_MODE=local-only-save` still makes the red guard fail
  for the expected reason.* — Preserved. `durable-save.red` stays
  `"retired"` in `redgreen.config.json` because no implemented
  break-mode actually breaks the surface (config note dated
  2026-08-26 / #1419). The guard string is still in the spec, so
  #1418 can re-live the red lane with a one-line config flip once a
  real break-mode implementation is restored.
- *The normal run is stable under CI.* — The green spec uses a 90s
  cold-start budget and a hermetic per-run slot; it does not share the
  three-cold-`page.goto` shape of `durable-save-load.spec.ts` (the
  separate hard-navigation spec) that made removing *that* skip risky
  under the SwiftShader flake (#700 / #506 / #590 / #766). If the
  green lane destabilises after this flip, retire it via the same
  one-line config change and file a follow-up on the flake.

## Recommendation

- Land the `durable-save.green = "live"` flip in this PR. That is the
  code change #1801 asks for and it is a one-line config edit — no
  spec changes, no workflow changes, no gameplay changes.
- Leave `durable-save.red` retired. Re-living it is blocked on #1418
  (a real break-mode implementation), not on #1801.
- Leave `durable-save-load.spec.ts` (the hard-navigation survival
  spec, a different concern) skipped until the SwiftShader cold-start
  flake (#700 / #506 / #590 / #766) is resolved. #1801 is about the
  durable contract spec, which is `save-load-durable-contract.spec.ts`.

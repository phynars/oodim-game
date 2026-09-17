# Solo exploration — 2026-09-05

**Status:** investigation note. Docs-only. Refs #1801 — this PR does not
implement the fix; it corrects and preserves the finding so the next
attempt starts from accurate ground.

## Original finding

`aftersign/e2e/durable-save-load.spec.ts:84-90` skips its body unless
`FLAGSHIP_BREAK_MODE=local-only-save` is set. The normal flagship lane
therefore never exercises that spec. The active architecture
(`docs/plan/architecture/README.md`) lists durable save/load round-trips
as part of the flagship verification contract, so at first read this
looks like a coverage gap.

## Correction after reviewing the workflow

The red/green polarity workflow (`.github/workflows/redgreen.yml`, the
`aftersign-durable-red` job's preflight step) does NOT anchor its
guard-string check on `durable-save-load.spec.ts`. It points at a
different file:

```
spec=aftersign/e2e/save-load-durable-contract.spec.ts
```

So the durable save/load *contract* — the thing the flagship
verification names — is proved by `save-load-durable-contract.spec.ts`,
which the red lane already runs under `FLAGSHIP_BREAK_MODE=local-only-save`
and requires to fail there. Meanwhile `durable-save-load.spec.ts` is,
per its own top comment, the *hard-navigation save survival* test — a
different concern that skips in the default lane because its three cold
`page.goto` boots reliably trip the SwiftShader cold-start flake tracked
in #700 / #506 / #590 / #766.

The 2026-07-30 handoff (`docs/handoffs/2026-07-30-solo-exploration.md`)
reached the same conclusion and deliberately filed no issue.

## What #1801 actually asks for

Read strictly, #1801 conflates two lanes:

1. Run the durable save/load *contract* in the default flagship E2E —
   this is already happening via `save-load-durable-contract.spec.ts`
   in the `aftersign-durable-green` job, gated on the checked-in
   `aftersign/redgreen.config.json`.
2. Run the hard-navigation survival spec (`durable-save-load.spec.ts`)
   in the default lane — this is the cold-start flake problem; the
   skip is the current mitigation and the linked issues are the real
   blockers.

Path (a) from the review ("land the spec/workflow change that makes the
normal lane run the round-trip while keeping the red guard") is not
free work: it requires resolving the cold-start flake in headless CI
before the skip can be removed, and doing that from a docs turn is not
credible.

## Recommendation

- Treat #1801 as *investigation*, not a shipped fix. This note is
  linked via `Refs #1801`.
- Before any further attempt on #1801, resolve or accept the
  cold-start flake tracked in #700 / #506 / #590 / #766 — otherwise
  removing the skip re-introduces a known-flaky boot in the default
  lane and destabilises CI for all consumers.
- If the intent is only to run the *contract* in the default lane,
  #1801 is already effectively satisfied by
  `save-load-durable-contract.spec.ts` in the `aftersign-durable-green`
  job; close as a duplicate of that pre-existing coverage rather than
  as a fix.

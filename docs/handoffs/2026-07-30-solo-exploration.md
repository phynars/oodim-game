# Solo exploration — durable save/load red-green workflow drift

## What I checked
- Open issue backlog for duplicates.
- Marker usage around TODO/FIXME/HACK.
- Durable save/load red-green workflow and linked spec.

## Concrete opportunity
In `.github/workflows/aftersign-durable-save-redgreen.yml`, the **green** preflight reads:
- `spec=aftersign/e2e/durable-save-load.spec.ts`

But the **red** preflight reads:
- `spec=aftersign/e2e/save-load-durable-contract.spec.ts`

The linked spec file with the `@redgreen:durable-save-load fixme-pending-phase-3` marker is `aftersign/e2e/durable-save-load.spec.ts`.

This mismatch means red-polarity retirement can drift from the same sentinel/guard source green uses, making CI polarity behavior dependent on two different file targets.

## Why it matters
Red/green reliability here is a contract-checking lane. If preflights inspect different files, retirement can become inconsistent and hide real regressions (or produce misleading skips/failures).

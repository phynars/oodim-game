# Solo exploration — AFTERSIGN durable save/load red/green workflow

## What I checked
- Open issue backlog for duplicates.
- Marker usage around TODO/FIXME/HACK.
- `.github/workflows/aftersign-durable-save-redgreen.yml` and its two
  preflight targets.

## What I first thought
The two preflights read different spec files:

- Green: `aftersign/e2e/durable-save-load.spec.ts`
- Red:   `aftersign/e2e/save-load-durable-contract.spec.ts`

My first pass called this "drift" and implied a workflow fix was warranted.

## Why that was wrong (correction from Soren)
The asymmetry is intentional and documented in the workflow comments:

- **Green** retires SOFT on the `@redgreen:durable-save-load
  fixme-pending-phase-3` marker in `durable-save-load.spec.ts` — the
  phase-3 spec that hasn't stabilized under CI cold-start yet.
- **Red** retires on the ABSENCE of the guard string in
  `save-load-durable-contract.spec.ts` — the shared-contract spec that
  the `local-only-save` break mode is supposed to fail against.
- Critically, the red preflight has a **fail-loud middle branch**
  (workflow lines ~127-135): if `test.skip(` survives but the
  `FLAGSHIP_BREAK_MODE=local-only-save` sentinel has been renamed or
  drifted, the workflow errors so a human decides. A unified single-file
  sentinel would delete that footgun-catcher.

Current state of the tree: `save-load-durable-contract.spec.ts` no
longer exists (the server-authoritative save path landed and retired
the shared-contract spec), so red hits its third branch (`retired=true`)
and correctly matches green's retired state. No behavior change is
warranted.

## Conclusion
No issue filed. The asymmetry is a feature, not a bug — two files
because the two polarities check two different invariants, and the
red preflight's three-branch structure is load-bearing.

If someone later wants to unify the sentinel anyway, treat it as a
real workflow change with regression risk (losing the silent-rename
detector), not a doc touch-up.

# Solo exploration — 2026-07-12

## What I checked
- Open issue backlog (`list_issues`, 30 newest open).
- Repo-wide `TODO|FIXME|HACK` scan.
- Studio architecture doc: `docs/plan/architecture/README.md`.

## Concrete opportunity
`aftersign-npc-memory-redgreen.yml` currently retires its red-lane step by grepping for a **literal test title** in `aftersign/e2e/flagship-surface-contract.spec.ts`:

```sh
grep -Pzo '(?s)test\.fixme\(\s*"npc-memory round-trip' "$spec"
```

If that fixme test is renamed but still fixme, the workflow will stop detecting retirement state and can re-enable red polarity at the wrong time.

## Proposed follow-up
File a CI refactor issue to replace title-coupled grep detection with a robust condition (e.g. guard by tagged test metadata or parse Playwright list output), so red-lane retirement is not coupled to string literals in spec titles.

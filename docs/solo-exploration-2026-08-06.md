# Solo exploration notes (Ivy, 2026-08-06)

## What I checked
- Open issue backlog (latest 5 open issues).
- Repo-wide TODO/FIXME/HACK scan.
- Markdown headings across `docs/**/*.md`.

## Raw observations
- Open issues currently visible: #978, #959, #956, #954, #615.
- TODO/FIXME/HACK scan returned **29 matches across 9 files**. Breakdown:
  - `aftersign/e2e/durable-save-load.spec.ts:28` and
    `aftersign/e2e/npc-memory-roundtrip.spec.ts:3` — live
    `@redgreen:<spec> fixme-pending-phase-3 expires=2026-12-31 owner=charlie-shin`
    markers on `test.fixme` placeholders.
  - `aftersign/e2e/flagship-reload-beat-regression.spec.ts:16` — same
    `test.fixme` pattern tied to Phase 3 (#566).
  - `.github/workflows/aftersign-durable-save-redgreen.yml` and
    `.github/workflows/aftersign-npc-memory-redgreen.yml` — CI preflights
    that *enforce* the marker convention (unexpired `expires=…` metadata,
    polarity retirement while the marker is present).
  - `aftersign/e2e/redgreen-gates.json` — the explicit gate source
    referenced by those workflows.
  - `docs/handoffs/2026-07-10-solo-exploration.md` and
    `docs/handoffs/2026-07-30-solo-exploration.md` — prior handoffs that
    already document these exact markers.
- Docs heading scan returned content from:
  - `docs/engine-integration-research.md`
  - `docs/flagship/BRIEF.md`
  - `docs/flagship/concept.md`

## Assessment
The `fixme-pending-phase-3` markers are the same ones the 2026-07-10
handoff already triaged: explicit `test.fixme` placeholders tied to the
already-open phased issues (#564 / #565 / #566 / #567). They're not
untracked debt — they carry expiry metadata (`expires=2026-12-31
owner=charlie-shin`) that CI actively enforces in
`aftersign-durable-save-redgreen.yml` and `aftersign-npc-memory-redgreen.yml`
(the preflight fails the workflow if the marker is missing metadata or
past its expiry).

Landing on the 2026-07-10 conclusion: **no new issue filed** — these
markers are tracked, guarded by CI, and duplicating them in the backlog
would be noise.

## Correction
An earlier draft of this note claimed the TODO/FIXME/HACK scan returned
no matches. That was wrong — see the enumerated matches above. The scan
does find 29 matches; they're just all already-tracked or CI-machinery,
which is why no new issue is warranted.

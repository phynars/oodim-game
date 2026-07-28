# Architecture Docs — Entry Point

> **STANDING MANDATE (read this first):** All NEW work in this repository is
> **flagship-first**. The flagship is AFTERSIGN — see
> [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md) for the mandate, scope,
> and current milestone. Do not start new features in the legacy game
> directories.

## Where new work goes

- **AFTERSIGN (`aftersign/`)** — the flagship. All new features, harness
  work, and milestone slices land here. Start from
  [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md) and the current
  product plan at [`docs/plan/product-plan.md`](../product-plan.md).
- **Shared e2e infrastructure (`e2e-shared/`)** — only when a flagship
  slice needs it.

## Legacy games — FROZEN (historical context only)

The per-game directories below are **frozen**. Their architecture docs are
retained as archival context — they describe how each scaffold was built,
not an active roadmap. The ONLY acceptable change to a frozen game is a
**player-breaking bug fix**; new features, refactors, and harness work in
these directories will be redirected to the flagship.

| Game | Docs | Status |
|------|------|--------|
| `pacman/` | [`pacman/docs/`](../../../pacman/docs/) | Frozen — archival |
| `galaga/` | [`galaga/docs/`](../../../galaga/docs/) | Frozen — archival |
| `doom/` | [`doom/docs/`](../../../doom/docs/) | Frozen — archival |
| `agar/` | [`agar/STATUS.md`](../../../agar/STATUS.md) | Frozen — archival |

If you arrived here from an issue or plan that directs you toward one of
these directories for NEW work, the issue predates the flagship mandate —
check [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md) before acting,
and prefer filing/asking over silently building in a frozen area.

## Contributor path (first read → first PR)

1. Read [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md) — the mandate.
2. Read [`docs/plan/product-plan.md`](../product-plan.md) — the current
   milestone and its open slices.
3. Pick an open flagship issue; legacy-game issues labeled
   `agent-needs-human` or predating the mandate are NOT the backlog.
4. All changes ship through CI-gated PRs; the aftersign lane and its
   red/green harness workflows are the merge gate for flagship work.

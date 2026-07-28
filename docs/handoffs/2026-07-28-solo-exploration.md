# Solo exploration — 2026-07-28

## What I checked
- Open issue backlog for duplicates/noise.
- `docs/plan/architecture/README.md` (new-contributor entry point).
- `docs/flagship/BRIEF.md` (current studio mandate).

## Finding
There is a docs-level contradiction:

- `docs/plan/architecture/README.md` presents the repo as an actively developed multi-game portfolio and tells contributors to work across `pacman/`, `galaga/`, `doom/`, and `agar`.
- `docs/flagship/BRIEF.md` states those four games are frozen and all new work should be flagship-only.

This creates onboarding drift: the architecture entry point sends contributors toward work the brief explicitly forbids.

## Recommended follow-up
File an issue to align architecture/onboarding docs with the flagship-only operating model (while preserving historical context as archival/background).
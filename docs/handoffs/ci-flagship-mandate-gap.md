# Solo exploration note: flagship mandate vs CI scope

## Observation
`docs/plan/architecture/README.md` declares a standing mandate that new work is **flagship-first** and that `pacman/`, `galaga/`, `doom/`, and `agar/` are **FROZEN** except for player-breaking bugs.

However, `.github/workflows/ci.yml` still runs full typecheck/build/e2e lanes for each frozen game on normal CI:

- `typecheck:pacman` / `build:pacman` / `test:e2e:pacman` (around lines 80–83)
- `typecheck:galaga` / `build:galaga` / `test:e2e:galaga` (around lines 104–107)
- `typecheck:doom` / `build:doom` / `test:e2e:doom` (around lines 128–131)
- `typecheck:agar` / `build:agar` / `test:e2e:agar` (around lines 152–155)

## Why this matters
This keeps expensive frozen-game validation in the default path, increasing CI runtime/cost and reducing feedback speed for active flagship work.

## Candidate fix shape
Refocus default CI on flagship + shared tooling; move frozen-game jobs behind explicit triggers (label/manual/scheduled) or a dedicated archival workflow.
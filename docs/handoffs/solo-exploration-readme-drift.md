# Solo exploration note — README/docs drift

## Observation
`docs/plan/architecture/README.md` defines a boundary: studio docs should stay cross-cutting and per-game internals should live in `<game>/docs/ARCHITECTURE.md`.

The top-level `README.md` currently includes deep per-game implementation detail (runtime verification mechanics and slice-by-slice delivery notes), which duplicates architecture-level content and creates a drift risk.

## Candidate improvement
Trim top-level `README.md` to a concise portfolio overview and deep-link per-game details to each game's architecture doc.

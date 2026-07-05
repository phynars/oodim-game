# Architecture — oodim Game

Canonical entry point for how this repo is structured. New contributors:
start here, then follow the links into deeper docs.

> Repo mission: a small autonomous game studio (five AI avatars) ships
> multiple playable games from **one repo** through the AIDLC loop
> (issue → PR → CI → merge). See the top-level [`README.md`](../../../README.md)
> for the studio framing.

## System overview

The repo is a **portfolio monorepo**: each game is a **self-contained
subdirectory** with its own vite config, tsconfig, and Playwright
gameplay harness, published to its own subpath behind a shared
"CI for gameplay" gate.

```
oodim-game/
├── landing/        → game.oodim.com/           (static portfolio index)
├── pacman/         → game.oodim.com/pacman/    (complete — 2D canvas)
├── galaga/         → game.oodim.com/galaga/    (complete — 2D canvas)
├── doom/           → game.oodim.com/doom/      (complete — three.js / WebGL)
├── agar/           → game.oodim.com/agar/      (in dev — server-authoritative multiplayer)
└── docs/                                       (studio-level docs — this tree)
```

Per-project scripts are `build:<project>` / `typecheck:<project>` /
`test:e2e:<project>`. The bare `build` / `typecheck` / `test:e2e`
aggregate across all products.

## Runtime boundaries

Three shapes of runtime live in this repo — the boundary between them is
what dictates how each game is verified:

| Shape | Games | Verification contract |
|---|---|---|
| **2D canvas, single-player** | `pacman/`, `galaga/` | Playwright drives inputs; assertions read a `window.__game` **state contract** (score, lives, ghost modes, collisions). Never pixels. |
| **True-3D WebGL, single-player** | `doom/` | Playwright over **headless Chromium with SwiftShader**; asserts `window.__doom` state (player pose, enemies, projectiles, doors). Deterministic fixed-timestep sim decoupled from rendering. |
| **Server-authoritative multiplayer** | `agar/` | Real WebSocket round-trip through `wrangler dev` (Durable Object). Two browser contexts converge on the same authoritative snapshot; the harness times out red if the round-trip doesn't happen. |

Common thread: **state assertions, not pixel diffs**. A game's correctness
is interactive, so the merge gate drives the game and inspects the
canonical in-memory state.

## Key package/app boundaries

- **Per-game code** lives entirely under that game's subdirectory —
  `<game>/src/`, `<game>/index.html`, `<game>/vite.config.ts`,
  `<game>/tsconfig.json`, `<game>/tests/` (Playwright).
- **Per-game deep docs** live under `<game>/docs/ARCHITECTURE.md` — the
  source of truth for that product's internal structure (game loop,
  rendering, input, AI, state contract). Read the per-game doc before
  changing per-game code.
- **Studio-level docs** (this tree, `docs/`) cover cross-cutting
  concerns: flagship brief, engine-integration research, plans, and
  handoffs. Nothing under `docs/` should describe game internals — that
  belongs in `<game>/docs/`.

## Deeper docs

Per-game architecture (start here for code changes inside a game):

- Pac-Man — [`pacman/docs/ARCHITECTURE.md`](../../../pacman/docs/ARCHITECTURE.md)
- Galaga — [`galaga/docs/ARCHITECTURE.md`](../../../galaga/docs/ARCHITECTURE.md)
- Doom — [`doom/docs/ARCHITECTURE.md`](../../../doom/docs/ARCHITECTURE.md)
- agar — see `agar/` (slice-by-slice; docs land as slices land)

Studio-level:

- Flagship studio brief — [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md)
- Flagship concept (AFTERSIGN) — [`docs/flagship/concept.md`](../../flagship/concept.md)
- Engine-integration research — [`docs/engine-integration-research.md`](../../engine-integration-research.md)

Roadmap and rationale for this repo as an AIDLC experiment live in the
main oodim repo at `docs/plan/multi-repo-greenfield-experiment.md`.

## When to update this file

Update this README when:

- A new game subdirectory lands (add it to the tree and the runtime table).
- A new runtime shape appears (a fourth row in the boundaries table).
- A new studio-level doc lands under `docs/` that a new contributor
  would benefit from seeing on day one.

Per-game internals do **not** belong here — put those in
`<game>/docs/ARCHITECTURE.md`.

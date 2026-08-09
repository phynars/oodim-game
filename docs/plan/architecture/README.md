# Architecture — oodim Game

Canonical entry point for how this repo is structured. New contributors:
start here, then follow the links into deeper docs.

> **Standing mandate (2026-07-04):** All new work is **flagship-first**.
> Pac-Man, Galaga, Doom, and agar are **FROZEN** — historical context,
> not active roadmap. The only acceptable old-game work is a
> player-breaking bug. See [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md)
> for the full mandate; if this doc and the brief ever disagree, the brief
> wins.

> Repo mission: a small autonomous game studio (five AI avatars) ships
> games from **one repo** through the AIDLC loop (issue → PR → CI →
> merge). The first four games proved the studio; the next work is a
> single original flagship. See the top-level
> [`README.md`](../../../README.md) for the studio framing.

## Where to contribute (read this first)

- **Flagship work** — the default. Start at
  [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md) and
  [`docs/flagship/concept.md`](../../flagship/concept.md). Every new
  issue, PR, and branch should be flagship-first unless it fixes a
  player-breaking bug in a frozen game.
- **Frozen games** (`pacman/`, `galaga/`, `doom/`, `agar/`) — archival.
  No new features, no new clones. Touch these only to fix a
  player-breaking bug, and label the issue accordingly.
- **Studio-level docs** (this tree) — update when the shape of the
  studio changes (new runtime, new cross-cutting doc).

## System overview (historical portfolio layout)

The repo grew as a **portfolio monorepo** while the studio was proving
itself: each of the four frozen games is a self-contained subdirectory
with its own vite config, tsconfig, and Playwright gameplay harness,
published to its own subpath behind a shared "CI for gameplay" gate.
The flagship now lives in `aftersign/` alongside these under the same
conventions.

```
oodim-game/
├── landing/        → game.oodim.com/           (static portfolio index)
├── pacman/         → game.oodim.com/pacman/    (FROZEN — historical, 2D canvas)
├── galaga/         → game.oodim.com/galaga/    (FROZEN — historical, 2D canvas)
├── doom/           → game.oodim.com/doom/      (FROZEN — historical, three.js / WebGL)
├── agar/           → game.oodim.com/agar/      (FROZEN — historical, server-authoritative multiplayer)
├── aftersign/      → game.oodim.com/aftersign/ (FLAGSHIP — active)
└── docs/                                       (studio-level docs — this tree; flagship docs live under docs/flagship/)
```

Per-project scripts are `build:<project>` / `typecheck:<project>` /
`test:e2e:<project>`. The bare `build` / `typecheck` / `test:e2e`
aggregate across all products.

## Runtime boundaries (from the frozen portfolio)

Three shapes of runtime were proved by the frozen games — the boundary
between them is what dictates how each was verified. The flagship
inherits the WebGL + server-authoritative rungs and extends the harness
to cover story/state invariants and NPC-memory round-trips (see the
brief's "Extend the gameplay harness before the gameplay").

| Shape | Games (frozen) | Verification contract |
|---|---|---|
| **2D canvas, single-player** | `pacman/`, `galaga/` | Playwright drives inputs; assertions read a `window.__game` **state contract** (score, lives, ghost modes, collisions). Never pixels. |
| **True-3D WebGL, single-player** | `doom/` | Playwright over **headless Chromium with SwiftShader**; asserts `window.__doom` state (player pose, enemies, projectiles, doors). Deterministic fixed-timestep sim decoupled from rendering. |
| **Server-authoritative multiplayer** | `agar/` | Real WebSocket round-trip through `wrangler dev` (Durable Object). Two browser contexts converge on the same authoritative snapshot; the harness times out red if the round-trip doesn't happen. |
| **Flagship — story/state (active)** | `aftersign/` | Playwright asserts a `window.__game` **state contract** (story/state invariants), verifies **NPC-memory round-trips** (write a memory, advance the sim, assert recall) and **save/load**, over a **deterministic fixed-timestep sim** decoupled from rendering. Contract defined by the brief's ["Extend the gameplay harness before the gameplay"](../../flagship/BRIEF.md). |

Common thread: **state assertions, not pixel diffs**. A game's correctness
is interactive, so the merge gate drives the game and inspects the
canonical in-memory state.

## Key package/app boundaries

- **Per-game code** lives entirely under that game's subdirectory —
  `<game>/src/`, `<game>/index.html`, `<game>/vite.config.ts`,
  `<game>/tsconfig.json`, `<game>/tests/` (Playwright). The flagship
  **follows this shape today** in `aftersign/` — served page
  `aftersign/index.html` importing `aftersign/main.js` (modularized
  2026-08-01), contracts under `aftersign/src/` and
  `packages/aftersign/`, e2e under `aftersign/e2e/`.
- **Per-game deep docs** live under `<game>/docs/ARCHITECTURE.md` — the
  source of truth for that product's internal structure (game loop,
  rendering, input, AI, state contract). For the frozen games these
  docs are **archival reference**; read them only when fixing a
  player-breaking bug or reusing a technique for the flagship.
- **Studio-level docs** (this tree, `docs/`) cover cross-cutting
  concerns: flagship brief, engine-integration research, plans, and
  handoffs. Nothing under `docs/` should describe game internals — that
  belongs in `<game>/docs/`.

## Deeper docs

**Flagship (start here for all new work):**

- Studio brief (standing mandate) — [`docs/flagship/BRIEF.md`](../../flagship/BRIEF.md)
- Flagship concept (AFTERSIGN) — [`docs/flagship/concept.md`](../../flagship/concept.md)

**Frozen-game architecture (archival — reference only, no new features):**

- Pac-Man — [`pacman/docs/ARCHITECTURE.md`](../../../pacman/docs/ARCHITECTURE.md) *(frozen)*
- Galaga — [`galaga/docs/ARCHITECTURE.md`](../../../galaga/docs/ARCHITECTURE.md) *(frozen)*
- Doom — [`doom/docs/ARCHITECTURE.md`](../../../doom/docs/ARCHITECTURE.md) *(frozen)*
- agar — [`agar/docs/ARCHITECTURE.md`](../../../agar/docs/ARCHITECTURE.md) *(frozen)*

**Studio-level:**

- Engine-integration research — [`docs/engine-integration-research.md`](../../engine-integration-research.md)

Roadmap and rationale for this repo as an AIDLC experiment live in the
main oodim repo at `docs/plan/multi-repo-greenfield-experiment.md`.

## When to update this file

Update this README when:

- The flagship subdirectory lands (add it to the tree and the runtime table).
- A new runtime shape appears (a new row in the boundaries table — e.g.
  the flagship's story/NPC-memory harness once its contract is stable).
- A new studio-level doc lands under `docs/` that a new contributor
  would benefit from seeing on day one.
- The flagship mandate itself changes (mirror the change from
  `docs/flagship/BRIEF.md` — the brief remains the source of truth).

Per-game internals do **not** belong here — put those in
`<game>/docs/ARCHITECTURE.md`.

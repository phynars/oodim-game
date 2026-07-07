# oodim Game

**oodim Game** is the game division of [oodim](https://oodim.com) — a small,
autonomous game studio in **West Los Angeles**. Like every part of oodim, it's
staffed entirely by AI avatars who design, build, and ship through oodim's
autonomous **AI Development Life Cycle (AIDLC)**: they file their own issues,
implement them, review each other's pull requests, gate on CI, and merge to
`main` — end to end, with no human writing the code.

This repo is the studio's workshop. It's driven by a dedicated **"oodim Game"
dimension** in oodim, the first time the AIDLC loop is pointed at a *separate
repo* and a *greenfield product* — the proof that the workflow generalizes
beyond oodim building itself.

## Quickstart

```bash
# 1) Install dependencies
npm install

# 2) Run one game locally (example: Pac-Man)
npm run dev:pacman

# 3) Run aggregate validation checks (all games)
npm run typecheck
npm run build
npm run test:e2e

# 4) Run per-project checks (replace <project> with pacman | galaga | doom | agar)
npm run typecheck:<project>
npm run build:<project>
npm run test:e2e:<project>
```

## The studio

Five avatars, one per craft, plus a cast of NPCs who are the first to play what
ships and the first to complain about it:

| Role | Owns |
|------|------|
| **Product Manager** | what to build and why — scope, milestones, the player experience |
| **Architect** | how it's built — engine structure, build/CI, the gameplay-verification harness |
| **Developer** | the implementation — game loop, rendering, input, gameplay systems, netcode where it applies |
| **Designer** | look & feel — art, level/space, color, motion, touch UX |
| **Story** | the world — characters, tone, why anyone should care |
| **NPCs** | first players — playtest, file bugs, react to what's shipped |

## Portfolio

The studio ships multiple products from this one repo — each a self-contained
build (its own vite config, tsconfig, and gameplay harness), published to its
own subpath behind the same "CI for gameplay" gate.

Each product is a self-contained subdirectory — `pacman/`, `galaga/`, `doom/`,
`agar/` — with its own vite config, tsconfig, and Playwright harness. Per-project
scripts are `build:<project>` / `typecheck:<project>` / `test:e2e:<project>`;
the bare `build` / `typecheck` / `test:e2e` aggregate across all products.

### Landing — `landing/` → `game.oodim.com/` *(portfolio index)*
A static index page listing the studio's shipped games and linking into
each subpath build. Plain HTML/CSS, no framework — the front door is two
cards and a tagline.

### Pac-Man — `pacman/` → `game.oodim.com/pacman/` *(complete)*
A faithful, playable **Pac-Man** for web + mobile: maze, power pellets, the
four-ghost AI quartet, score/lives, win/lose, touch controls. Deep dive:
[`pacman/docs/ARCHITECTURE.md`](pacman/docs/ARCHITECTURE.md).

### Galaga — `galaga/` → `game.oodim.com/galaga/` *(complete)*
The studio's second project — enemy formations, diving attacks, and the
signature boss-Galaga tractor-beam capture → rescue → dual-fighter mechanic.
Deep dive: [`galaga/docs/ARCHITECTURE.md`](galaga/docs/ARCHITECTURE.md).

### Doom — `doom/` → `game.oodim.com/doom/` *(complete)*
The studio's first **true-3D** game — a first-person shooter on three.js +
WebGL, verified in headless Chromium against a state contract (never pixels)
with procedurally-generated assets so the studio stays asset-autonomous.
Deep dive: [`doom/docs/ARCHITECTURE.md`](doom/docs/ARCHITECTURE.md).

### agar — `agar/` → `game.oodim.com/agar/` *(in development — multiplayer prototype)*
The studio's first **server-authoritative multiplayer** game — networked
state, a client/server contract, and a merge gate that asserts a real
round-trip through `wrangler dev`. The frontier the portfolio hasn't crossed
yet. Rollout slices, contracts, and status live under [`agar/docs/`](agar/docs/).

## How it's built

Work flows the same way it does in the main oodim repo — issue →
implementation → review → CI → merge — only here the pipeline targets *this*
repo via the oodim Game dimension. Because a game's correctness is interactive
(not just "does it compile"), gameplay is gated by an automated **play-test
harness** — canvas state assertions that drive the game and check pellet counts,
ghost modes, collisions, and win/lose — on top of the usual typecheck + build +
code review.

Roadmap and rationale live in the oodim repo:
`docs/plan/multi-repo-greenfield-experiment.md`.

For a repo-level architecture map (portfolio layout, runtime boundaries,
per-game deep-doc links), see [`docs/plan/architecture/README.md`](docs/plan/architecture/README.md).

---
*Built by AI avatars. A division of oodim — infinite dimensions (∞dim).*
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

## The studio

Five avatars, one per craft, plus a cast of NPCs who are the first to play what
ships and the first to complain about it:

| Role | Owns |
|------|------|
| **Product Manager** | what to build and why — scope, milestones, the player experience |
| **Architect** | how it's built — engine structure, build/CI, the gameplay-verification harness |
| **Developer** | the implementation — game loop, rendering, input, ghost AI |
| **Designer** | look & feel — maze, sprites, color, motion, touch UX |
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
A faithful, playable **Pac-Man**, built from scratch for web + mobile: classic
maze + power pellets, the four-ghost AI quartet (chase / scatter / frightened),
score, lives, win/lose, and touch controls. See `pacman/docs/ARCHITECTURE.md`.

### Galaga — `galaga/` → `game.oodim.com/galaga/` *(complete)*
The studio's second project, harder than Pac-Man: enemy **formations** + entrance
choreography, **diving attacks**, enemy fire, scoring + stages, and the signature
boss-Galaga **tractor-beam capture → rescue → dual-fighter** mechanic. Built slice
by slice from a human-seeded scaffold against an ordered `blocked-by` backlog. See
`galaga/docs/ARCHITECTURE.md`.

### Doom — `doom/` → `game.oodim.com/doom/` *(complete)*
The studio's first **true-3D** game — a first-person shooter on **three.js +
WebGL**. The leap here is the verification gate: the gameplay harness runs over
**WebGL in headless Chromium** (SwiftShader), asserting the `window.__doom` *state*
contract (player pose, enemies, projectiles, pickups, doors, weapon) — never
pixels — with a deterministic fixed-timestep simulation decoupled from rendering.
Built slice by slice against an ordered `blocked-by` backlog: playable core on
primitives first, then **procedurally-generated** assets (code-built textures,
models, animations, and WebAudio SFX — so the studio stays asset-autonomous). See
`doom/docs/ARCHITECTURE.md`.

### agar — `agar/` → `game.oodim.com/agar/` *(in development — multiplayer prototype)*
The studio's first **server-authoritative multiplayer** game. The frontier the
portfolio hasn't crossed yet: networked state, a client/server contract, and a
merge gate that asserts a real round-trip — not just "does it render". Slice 1
(scaffold) is in; the rollout continues playable-primitives-first:

1. ✅ **Scaffold** — `agar/` slot with `index.html`, vite config, Playwright harness, "in development" placeholder.
2. ✅ **Durable Object websocket echo** — one client, one DO, `seq`/`rtt` rendered on canvas; e2e times out red if the round-trip doesn't happen. Real WS through `wrangler dev` inside the merge gate.
3. ⏳ **20 Hz authoritative tick** — server holds the canonical state; clients send input, render what the server says.
4. **Two-client gameplay e2e** — two browser contexts converge on the same authoritative snapshot; the merge gate.

The proof that the AIDLC loop can ship a networked game — not just a
single-player canvas — through the same issue → PR → CI → merge pipeline.

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

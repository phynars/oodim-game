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

The studio ships multiple games from one repo. Each product is independently
deployed to its own subpath and validated through shared build, typecheck, and
gameplay CI gates.

### Landing — `landing/` → `game.oodim.com/` *(portfolio index)*
A lightweight directory page that links players to each shipped game.

### Pac-Man — `pacman/` → `game.oodim.com/pacman/` *(complete)*
A classic arcade maze game adapted for web + mobile, including score, lives,
and full win/lose flow.

Technical details: `pacman/docs/ARCHITECTURE.md`

### Galaga — `galaga/` → `game.oodim.com/galaga/` *(complete)*
An arcade shooter with stage progression, enemy attack waves, and the signature
dual-fighter loop.

Technical details: `galaga/docs/ARCHITECTURE.md`

### Doom — `doom/` → `game.oodim.com/doom/` *(complete)*
A browser-first first-person 3D shooter and the studio's flagship WebGL title.

Technical details: `doom/docs/ARCHITECTURE.md`

### agar — `agar/` → `game.oodim.com/agar/` *(in development)*
A multiplayer growth-and-survival prototype focused on server-authoritative
real-time play.

Technical details: see `agar/` (docs land slice by slice)

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
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

All new work is **flagship-first**: start with the flagship
(`aftersign`), not the frozen games. Read
[`docs/flagship/BRIEF.md`](docs/flagship/BRIEF.md) and
[`docs/flagship/concept.md`](docs/flagship/concept.md) before contributing.

```bash
# 1) Install dependencies
npm install

# 2) Run the flagship locally
npm run dev:aftersign

# 3) Run aggregate validation checks (all games)
npm run typecheck
npm run build
npm run test:e2e

# 4) Run per-project checks (replace <project> with aftersign | pacman | galaga | doom | agar)
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

## What the studio is building

All new work is **flagship-first** (standing mandate, 2026-07-04). The
flagship, **AFTERSIGN**, lives in `aftersign/` and is the only active
development target. The four games below it are **FROZEN** — historical proofs
that the studio works, not active roadmap. Only player-breaking bugs are
accepted against them; no new features, no new clones. See
[`docs/flagship/BRIEF.md`](docs/flagship/BRIEF.md) for the mandate and
[`docs/flagship/concept.md`](docs/flagship/concept.md) for the flagship
concept.

### AFTERSIGN — `aftersign/` → `game.oodim.com/aftersign/` *(FLAGSHIP — active)*
The studio's original flagship game — the active roadmap. Concept, scope, and
verification expectations live in
[`docs/flagship/concept.md`](docs/flagship/concept.md) and
[`docs/flagship/BRIEF.md`](docs/flagship/BRIEF.md).

### Landing — `landing/` → `game.oodim.com/` *(portfolio index)*
A lightweight directory page that links players to each shipped game.

### Pac-Man — `pacman/` → `game.oodim.com/pacman/` *(FROZEN — historical)*
A classic arcade maze game adapted for web + mobile, including score, lives,
and full win/lose flow.

Technical details (archival): `pacman/docs/ARCHITECTURE.md`

### Galaga — `galaga/` → `game.oodim.com/galaga/` *(FROZEN — historical)*
An arcade shooter with stage progression, enemy attack waves, and the signature
dual-fighter loop.

Technical details (archival): `galaga/docs/ARCHITECTURE.md`

### Doom — `doom/` → `game.oodim.com/doom/` *(FROZEN — historical)*
A browser-first first-person 3D shooter — the WebGL rung the flagship builds on.

Technical details (archival): `doom/docs/ARCHITECTURE.md`

### agar — `agar/` → `game.oodim.com/agar/` *(FROZEN — historical)*
A multiplayer growth-and-survival prototype — the server-authoritative
Durable-Object rung the flagship builds on.

Technical details (archival): see `agar/`

## How it's built

Work flows the same way it does in the main oodim repo — issue →
implementation → review → CI → merge — only here the pipeline targets *this*
repo via the oodim Game dimension. Because a game's correctness is interactive
(not just "does it compile"), gameplay is gated by an automated **play-test
harness**: Playwright drives the game and asserts against each project's
canonical in-memory **state contract** (exposed game state — entities, score,
win/lose flow, server round-trips — never pixels), on top of the usual
typecheck + build + code review. The flagship extends this harness with
story/state invariants and NPC-memory round-trip checks.

Roadmap and rationale live in the oodim repo:
`docs/plan/multi-repo-greenfield-experiment.md`.

For a repo-level architecture map (portfolio layout, runtime boundaries,
per-game deep-doc links), see [`docs/plan/architecture/README.md`](docs/plan/architecture/README.md).

---
*Built by AI avatars. A division of oodim — infinite dimensions (∞dim).*
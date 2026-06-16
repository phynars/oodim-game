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

## First project — Pac-Man

A faithful, playable **Pac-Man**, built from scratch for web + mobile:

- classic maze, pellets, and power pellets
- four ghosts with distinct chase / scatter / frightened AIs
- score, lives, win / lose
- touch controls for mobile, keyboard for desktop

**Ships to → https://game.oodim.com/pacman/**

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

---
*Built by AI avatars. A division of oodim — infinite dimensions (∞dim).*

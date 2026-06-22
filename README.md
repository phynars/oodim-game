# oodim-game

Autonomous game studio. Each subdirectory is one shipped game.

| Game | Genre | Engine | Status |
|------|-------|--------|--------|
| `pacman/` | 2D maze | canvas | shipped |
| `galaga/` | 2D shmup | canvas | shipped |
| `doom/` | true-3D FPS | three.js / WebGL | shipped |
| `agar/` | server-authoritative multiplayer | Cloudflare DOs (planned) | in design |
| `landing/` | portfolio index | static HTML/CSS | shipped |

See each game's `docs/` for its architecture. Issues are filed against
`phynars/oodim-game`; the AIDLC loop turns them into PRs and merges
without humans writing code.

## Open feel work

- **#230** — Doom pickup feel: flash + scale-pop + per-kind tint
  (Diego's queue; awaiting implementation).

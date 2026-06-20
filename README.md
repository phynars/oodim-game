# oodim Game Studio

Live: [game.oodim.com](https://game.oodim.com)

A portfolio of complete games shipped end-to-end by AI avatars via the
issue → PR → review → merge loop, with no human writing code. Each game
proves the AIDLC loop on rising technical complexity.

## Portfolio

| Game     | Genre              | Complexity axis proven                          |
|----------|--------------------|-------------------------------------------------|
| Pac-Man  | 2D maze            | tile pathfinding, ghost AI modes, fixed-timestep |
| Galaga   | 2D shmup           | wave choreography, formations, projectile pools  |
| Doom     | true-3D WebGL FPS  | software-style raycasting in WebGL, level data   |
| _agar_   | real-time MP       | **next rung — server-authoritative state**       |

## Layout

Each game is a self-contained Vite app under its own top-level directory
(`pacman/`, `galaga/`, `doom/`). The `landing/` directory is the
[game.oodim.com](https://game.oodim.com) front door — a static index of
the portfolio. Per-game scripts live in the root `package.json` and the
aggregate `build` / `test` / `e2e` scripts fan out to each game.

## Next rung

The portfolio has proven single-player, client-side canvas across rising
complexity. The frontier it has NOT proven is **server-authoritative
state**: real-time multiplayer (Cloudflare Durable Objects + websockets)
and/or backend persistence (accounts, saved progression, global
leaderboards). That is where real software lives — data modeling,
migrations, a client/server contract, multi-client testing — and it is
the most valuable thing the studio can prove next.

The first concrete proof in flight is an `agar/`-style real-time
multiplayer game (epic #130, scaffold #136, harness contract #129),
gated on platform-side write.paths allowlist (#142).

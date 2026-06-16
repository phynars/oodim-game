# Build Log — oodim Game builds Pac-Man

A public, running record of an experiment: can oodim's autonomous **AI
Development Life Cycle (AIDLC)** — the same loop that builds oodim itself — be
pointed at a *brand-new repo* and a *greenfield product*, and ship a playable
game with no human writing the code?

The studio is the **oodim Game** division (West LA): five role avatars (PM,
Architect, Developer, Designer, Story) + NPC playtesters, working in their own
oodim dimension. The target is a faithful, mobile-playable **Pac-Man** at
[game.oodim.com/pacman](https://game.oodim.com/pacman/).

This log is updated as each phase lands — it's the clue trail for how AIDLC
actually works in the open.

---

## Phase A — Scaffold (human-seeded bootstrap)
*2026-06-16*

The one part that can't be greenfield-autonomous: the empty-repo bootstrap. The
AIDLC loop needs *something* to anchor on — paths to route scope into, a build
to gate, a verification pattern to extend. So the scaffold is seeded by hand:

- **Vite + TypeScript + HTML5 canvas** web-game shell — renders a title screen,
  runs a `requestAnimationFrame` loop, mobile-fit canvas with touch disabled for
  rubber-banding. Ships under `/pacman/`.
- **The state contract** — `src/game/types.ts` defines `GameState`, mirrored on
  `window.__pac`. This is what makes a *game* verifiable: tests assert on game
  state, not pixels.
- **Gameplay verification harness** — `e2e/pacman.spec.ts` (Playwright) boots the
  game and checks the `__pac` contract. Every gameplay PR will add its own
  assertions here. This is the experiment's true gate: it answers "does it
  *play*?", which compile + code-review can't.
- **CI** — typecheck + build + e2e on every PR, the same merge bar as oodim.
- **`ARCHITECTURE.md`** — a deliberate module map so five avatars build one
  coherent game, not five overlapping fragments.

What's intentionally NOT here: the maze, movement, ghosts, pellets, scoring —
those are the autonomous backlog. The scaffold only makes the repo *buildable,
testable, and routable* so the loop can take over.

**Next:** wire the oodim pipeline to target this repo (multi-repo support), stand
up the oodim Game dimension + cast, then seed the ordered Pac-Man backlog.

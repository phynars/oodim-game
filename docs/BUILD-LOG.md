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

---

## Phase B — Multi-repo pipeline wiring (Phase 0 enabler)
*2026-06-16*

The oodim pipeline could only ever build *itself* — `phynars/oodim` was a
constant baked into ~30 modules (open-pr, auto-review, auto-merge, auto-iterate,
auto-decompose, rebase, branch-janitor, backlog-implement, queue-processor,
re-engage-stranded, steward, free-will-wake, and the agent tools). To point it
at a second repo we made the **target repo a per-dimension field**:

- `dimensions.repo` (`owner/name`, nullable) — `NULL` ⇒ the default
  `phynars/oodim`, so every existing dimension is unchanged by construction.
- `lib/repo-target.ts` resolves a dimension/conversation to its `RepoTarget`.
- `backlog-implement` now **groups code-enabled dimensions by resolved repo** and
  scans each repo's own `agent-filed` issues independently.
- `CodePermission.repo` flows the resolved repo down to every git/GitHub tool so
  an avatar reads, branches, and PRs against the *right* repo.

Shipped as PRs **#780** (per-dimension repo) + the per-repo backlog scan, both
deployed to staging.

## Phase C — The oodim Game dimension + cast
*2026-06-16*

Created the **oodim Game** dimension (`repo = phynars/oodim-game`,
`code_enabled`), owned by the admin, with a game-studio cast carrying the
"world-best traits" brief:

| Avatar | Role | Code |
|---|---|---|
| **Mara Okonkwo** | PM (dimension self) | write + review |
| **Soren Vask** | Architect | write (incl. `.github/`) + review |
| **Ivy Tran** | Developer | write + review |
| **Diego Salcedo** | Designer | write |
| **June Hallow** | Narrative | write |
| Bree Sandoval, Kaz Mirembe | NPC playtesters | — |

Each implementer's write scope is fenced to the game paths (`src/`, `e2e/`,
`docs/`, `public/`, build configs). The dimension runs **free-will OFF** — Pac-Man
is a *closed* spec, so it's issue-driven and converges to "done", unlike the
open-ended free-will dimensions. (Staging-only, like HQ and Capital.)

## Phase D — Gameplay verification gate
*2026-06-16*

No new infrastructure needed: oodim-game's CI runs `build` + `e2e` as required
checks, and the merge gate already blocks on CI. So the `window.__pac` Playwright
harness from Phase A **is** the gameplay gate — every slice's PR must extend it
with an assertion that fails on the old code and passes on the new, or it can't
merge. "CI for gameplay" comes for free once the repo's CI is required.

## Phase E — Ordered backlog + first drain
*2026-06-16*

Seeded a **10-slice ordered backlog** (`scripts/seed-backlog.py`), each issue
`blocked-by` its predecessor so the loop drains them in strict dependency order:

> game loop → maze + pellets → movement + input → Blinky AI → full ghost quartet
> → power pellets/frightened → collision + lives → win/lose → touch controls →
> HUD + polish

Only the head (#1) is ever a candidate; each slice unblocks the next when its PR
merges and closes it.

**First drain surfaced a real multi-repo bug** (exactly the kind of edge this
experiment exists to find): `backlog-implement`'s 7-day attempt-dedupe scanned
`code_sessions` *globally* and matched `#N` from prompts across all repos — so
`phynars/oodim`'s issue #1 falsely marked oodim-game's #1 "already attempted",
stalling the fresh backlog at zero. The blocked-by ordering and per-repo issue
scan both worked; the dedupe just wasn't repo-scoped. Fixed by scoping the
dedupe to the repo group's dimensions (and the queued-job dedupe by payload
repo). Shipped as `fix/backlog-dedupe-repo-scope`.

**Next:** the loop drains #1 → ships a PR → gameplay E2E gates the merge → #2
unblocks. The log continues per slice.

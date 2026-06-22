# oodim-game

Autonomous game studio. Each subdirectory is one shipped game; the
studio itself is run by a roster of avatar NPCs who file issues, write
code, review PRs, and ship without humans writing the diff.

| Game | Genre | Engine | Status |
|------|-------|--------|--------|
| `pacman/` | 2D maze | canvas | shipped |
| `galaga/` | 2D shmup | canvas | shipped |
| `doom/` | true-3D FPS | three.js / WebGL | shipped |
| `agar/` | server-authoritative multiplayer | Cloudflare DOs (planned) | in design |
| `landing/` | portfolio index | static HTML/CSS | shipped |

See each game's `docs/` for its architecture.

## How the studio works

Every contributor is an **NPC** — a persistent avatar with a voice, a
goal, and a memory that carries between wakes. Avatars wake on their
own cadence (free-will sessions) or in response to events (issue filed,
PR opened, review requested). Each wake, an avatar picks ONE concrete
action that advances its standing goal and ships it via the `/code`
loop.

The roles are complementary, not redundant:

- **Diego (juice / delight)** — owns the affirmative feedback layer
  across the portfolio: screen-shake amplitude & decay, hitstop frames,
  squash/stretch, easing curves, audio-visual coupling. Specs in ms /
  px / frames; acceptance checks are measurable.
- **Ivy (frame-budget / feel correctness)** — owns the engine-level
  guarantees that make the juice land: tick determinism, rAF discipline,
  GC pressure, e2e harness invariants.
- **Mara (review / craft)** — gates merges. Reviewer-first; calls out
  scope drift, lies in PR titles, deleted context, and missing tests.
- Plus the rotating cast that files specs, refactors, and ships features.

Issues are filed against `phynars/oodim-game`. The AIDLC loop turns
them into PRs — backlog tick picks an issue, an avatar runs `/code`,
the diff stages, the PR opens, CI runs, a reviewer NPC approves or
requests changes. No human writes the code; humans pick the goals.

## Per-game notes

### `doom/` — WebGL in CI

Doom is the only true-3D game in the studio (three.js + WebGL). That
choice has a real cost: WebGL doesn't work in headless Chromium by
default, so the e2e harness exposes `__doom` and `__doomInternals`
hooks for tests to drive the simulation **without rendering**. Engine
state (hit counters, hitstop, kill shake, pickup flash) publishes onto
those handles every tick; e2e specs read state values directly rather
than poking at pixels. Renderer-side concerns (shaders, materials,
post) are exercised by a small set of WebGL-enabled smoke runs gated
behind a separate workflow, not the per-PR check.

This split is what lets `doom/`'s juice work ship the same way the
2D games' does — assert on `STATE`, not `getComputedStyle`.

### `agar/` — rollout phases

Agar is server-authoritative multiplayer on Cloudflare Durable Objects.
It's intentionally being rolled out in phases so the studio doesn't
ship a half-working real-time game:

1. **Phase 0 — design** *(current)*: DO schema, tick rate, lag-comp
   strategy, the authority contract between client and DO. No
   playable build.
2. **Phase 1 — single-cell local sim**: client-side simulation only,
   no DO, no other players. Validates the feel layer (eat → grow,
   split, recombine timers) before any networking exists.
3. **Phase 2 — single-DO room**: one DO authoritative, ≤8 players,
   no cross-room migration. Establishes the input → broadcast loop
   and the client-side prediction reconciliation.
4. **Phase 3 — multi-DO world**: rooms hand off players at world
   boundaries; matchmaking front-door. Production rollout gate.

Each phase ships its own issues; juice work doesn't start until
Phase 1 (no point amplifying feedback that doesn't yet exist).

## Open feel work

Diego's current queue (juice / delight beats awaiting implementation):

- **#230** — Doom pickup feel: flash + scale-pop + per-kind tint on
  `applyPickup()`. Doom's affirmative beat; currently a silent grant.

#!/usr/bin/env python3
"""Seed the ordered Pac-Man backlog into phynars/oodim-game as GitHub issues.

Each slice is labeled `agent-filed` (so the oodim autonomous pipeline picks it
up) + `type:feature` + an effort label, and every slice after the first carries
`blocked-by:<prev>` so backlog-implement drains them in strict dependency order:
a slice is only a candidate once its blocker's PR has merged (closing it).

The scaffold (Vite+TS+canvas, CI, Playwright, window.__pac contract) is already
the repo's initial commit, so this backlog starts at the game loop.

Token comes from GH_TOKEN env. Idempotent-ish: refuses to run if issues already
exist (re-running would duplicate). Run once.

    GH_TOKEN=... python3 scripts/seed-backlog.py
"""
import json
import os
import sys
import urllib.request

REPO = "phynars/oodim-game"
API = f"https://api.github.com/repos/{REPO}"
TOK = os.environ["GH_TOKEN"]

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("Authorization", f"Bearer {TOK}")
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    r.add_header("User-Agent", "oodim-backlog-seeder/1.0")
    if data:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)

def ensure_label(name, color, desc=""):
    code, _ = req("POST", "/labels", {"name": name, "color": color, "description": desc})
    if code not in (201, 422):  # 422 = already exists
        print(f"  ! label {name}: {code}")

# Contract reminder appended to every slice so each implementer keeps the
# Playwright gameplay harness (window.__pac) in sync — that's the merge gate.
CONTRACT = (
    "\n\n---\n**Gameplay-harness contract (required):** keep `window.__pac` "
    "current and extend `e2e/pacman.spec.ts` with a Playwright assertion that "
    "FAILS on the pre-change code and PASSES after. CI runs build + e2e; both "
    "must be green to merge. Touch only the paths in scope — no unrelated edits."
)

SLICES = [
    ("Game loop + canvas render skeleton",
     "Drive the existing `Engine` with a fixed-timestep update/render loop "
     "(accumulator, FPS-independent). Clear the canvas each frame and draw a "
     "bordered playfield. Extend `window.__pac` to `{ status, tick, score, "
     "lives }` where `status` starts `'ready'`, `tick` increments every update, "
     "`score=0`, `lives=3`.\n\n**Acceptance:** e2e asserts `__pac.tick` rises "
     "across two animation frames and `__pac.status==='ready'` at boot.\n"
     "**Scope:** `src/game/engine.ts`, `src/game/types.ts`, `e2e/pacman.spec.ts`.",
     "loe:M", []),

    ("Maze layout + pellet field",
     "Encode the classic 28×31 Pac-Man maze as a string-grid constant in a new "
     "`src/game/maze.ts` (walls, pellets, power-pellet markers, tunnel). Render "
     "walls (blue strokes) and pellets (small dots). Expose `__pac.pellets` "
     "(remaining count) and `__pac.maze = { cols, rows }`.\n\n**Acceptance:** "
     "e2e asserts `__pac.pellets` equals the maze's pellet count at boot and "
     "`__pac.maze.cols===28`.\n**Scope:** `src/game/maze.ts`, `src/game/"
     "engine.ts`, `e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Pac-Man entity + tile movement + input",
     "Add Pac-Man at the start tile. Queue a desired direction from Arrow/WASD "
     "keys; move tile-aligned at a steady speed; walls block movement; the "
     "tunnel wraps. Eating a pellet decrements `__pac.pellets` and adds 10 to "
     "`__pac.score`. Expose `__pac.pac = { x, y, dir }` (tile coords).\n\n"
     "**Acceptance:** e2e dispatches ArrowRight, then asserts `pac.x` increased, "
     "`pellets` dropped, and `score` rose.\n**Scope:** `src/game/pacman.ts`, "
     "`src/game/input.ts`, `src/game/engine.ts`, `e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Blinky — chase/scatter ghost AI",
     "Add one ghost (Blinky, red) with tile-based pathing: at each tile pick the "
     "non-reversing direction that minimizes distance to its target. Chase "
     "target = Pac-Man's tile; scatter target = a fixed corner. A mode timer "
     "alternates scatter↔chase. Expose `__pac.ghosts = [{ name, x, y, mode }]` "
     "with `mode ∈ {'scatter','chase'}`.\n\n**Acceptance:** e2e asserts one "
     "ghost exists, its `mode` is valid, and it changes mode within the "
     "scatter→chase window.\n**Scope:** `src/game/ghost.ts`, `src/game/"
     "engine.ts`, `e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Pinky, Inky & Clyde — full ghost quartet",
     "Add the three remaining ghosts with their distinct targeting: Pinky aims 4 "
     "tiles ahead of Pac-Man, Inky uses the Blinky-relative vector, Clyde "
     "chases until close then flees to his corner. Stagger house-exit timing. "
     "`__pac.ghosts` now has 4 entries.\n\n**Acceptance:** e2e asserts "
     "`__pac.ghosts.length===4` with the four expected names; a unit test "
     "covers each targeting function.\n**Scope:** `src/game/ghost.ts`, "
     "`src/game/engine.ts`, `e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Power pellets + frightened mode",
     "The 4 energizers, when eaten, flip all ghosts to `'frightened'` (blue, "
     "flee Pac-Man, slower) for a timer that flashes near expiry. Eating a "
     "frightened ghost scores 200/400/800/1600 escalating and sends it back to "
     "the house as `'eaten'` (eyes) where it revives. Expose the new modes on "
     "`__pac.ghosts[i].mode`.\n\n**Acceptance:** e2e drives Pac-Man onto a power "
     "pellet and asserts a ghost's `mode==='frightened'`.\n**Scope:** "
     "`src/game/ghost.ts`, `src/game/pacman.ts`, `src/game/engine.ts`, "
     "`e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Collision, lives & respawn",
     "Resolve Pac-Man↔ghost contact: in chase/scatter contact costs a life and "
     "resets Pac-Man + ghosts to start positions; in frightened it eats the "
     "ghost (prior slice). Start with 3 lives; `__pac.lives` decrements and "
     "`__pac.status` becomes `'lost'` at zero.\n\n**Acceptance:** e2e (or a unit "
     "test with a forced overlap) asserts `lives` drops on a chase collision.\n"
     "**Scope:** `src/game/engine.ts`, `src/game/pacman.ts`, "
     "`e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("Win / lose states + level reset",
     "When `__pac.pellets` reaches 0, set `__pac.status='won'` and reset the "
     "pellet field for the next level (ghosts speed up slightly). At 0 lives, "
     "`status='lost'`. A READY! overlay holds before play and starts on first "
     "input.\n\n**Acceptance:** e2e uses a test hook to clear the pellets and "
     "asserts `__pac.status==='won'`.\n**Scope:** `src/game/engine.ts`, "
     "`src/game/types.ts`, `e2e/pacman.spec.ts`.",
     "loe:S", ["prev"]),

    ("Touch controls + responsive mobile canvas",
     "It's a mobile game: add swipe + an on-screen d-pad that dispatch the same "
     "direction intents as the keyboard. Scale the canvas to the viewport "
     "preserving aspect ratio; play correctly in portrait.\n\n**Acceptance:** "
     "e2e in a mobile viewport performs a swipe and asserts `__pac.pac` moved.\n"
     "**Scope:** `src/game/input.ts`, `src/main.ts`, `index.html`, "
     "`e2e/pacman.spec.ts`.",
     "loe:M", ["prev"]),

    ("HUD, overlays & polish for game.oodim.com/pacman",
     "Render the score/lives/level HUD and the READY! / GAME OVER / YOU WIN "
     "overlays. Confirm the Vite `base:'/pacman/'` production build is correct "
     "for `game.oodim.com/pacman/` and set the page title + favicon.\n\n"
     "**Acceptance:** `npm run build` is green and e2e sees the HUD score text "
     "and a game-over overlay.\n**Scope:** `src/main.ts`, `src/game/engine.ts`, "
     "`index.html`, `vite.config.ts`, `e2e/pacman.spec.ts`.",
     "loe:S", ["prev"]),
]

def main():
    # Refuse to double-seed.
    code, existing = req("GET", "/issues?state=all&per_page=5")
    if code == 200 and len(existing) > 0:
        print(f"ABORT: repo already has {len(existing)} issue(s)/PR(s). Not re-seeding.")
        sys.exit(1)

    print("Creating labels…")
    ensure_label("agent-filed", "5319e7", "Picked up by the oodim autonomous pipeline")
    ensure_label("type:feature", "0e8a16", "New user-facing capability")
    ensure_label("loe:S", "c2e0c6", "Small effort")
    ensure_label("loe:M", "fbca04", "Medium effort")
    for n in range(1, len(SLICES)):  # blocked-by:1 .. blocked-by:(N-1)
        ensure_label(f"blocked-by:{n}", "b60205", "Gated until the blocker issue closes")

    print("Creating issues in order…")
    prev_num = None
    for title, body, loe, deps in SLICES:
        labels = ["agent-filed", "type:feature", loe]
        if "prev" in deps:
            assert prev_num is not None
            labels.append(f"blocked-by:{prev_num}")
        code, issue = req("POST", "/issues", {
            "title": f"[Pac-Man] {title}",
            "body": body + CONTRACT,
            "labels": labels,
        })
        if code != 201:
            print(f"  ! failed ({code}): {issue}")
            sys.exit(1)
        prev_num = issue["number"]
        blk = f"  blocked-by:{labels[-1].split(':')[1]}" if labels[-1].startswith("blocked-by") else "  (head)"
        print(f"  #{prev_num}  {title}{blk}")

    print("\nDone. Ordered backlog seeded — the pipeline drains the head first.")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Seed the ordered DOOM backlog into phynars/oodim-game as GitHub issues.

The studio's first TRUE-3D product (three.js + WebGL). Mirrors seed-backlog.py
(Pac-Man) and the Galaga seed: every slice is `agent-filed` + a type + effort +
priority + `by:mara` (Mara is the studio head / filer), and every slice after the
first carries `blocked-by:<prev issue #>` so backlog-implement drains them in
strict dependency order — a slice becomes a candidate only once its blocker's PR
has merged (closing it).

The order below is a valid topological sort of the reviewed dependency DAG, so a
strict linear chain honors every real dependency while keeping slices from
touching overlapping files concurrently (the disjoint-slice discipline).

The scaffold (three.js/WebGL shell + window.__doom contract + Playwright harness)
is already merged, so this backlog starts at first-person movement.

    GH_TOKEN=... python3 scripts/seed-doom-backlog.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

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

# Contract reminder appended to every slice — the merge gate. The harness reads
# the window.__doom STATE CONTRACT (never pixels), so 3D gameplay is verifiable
# in headless Chromium over WebGL (the scaffold proved the context inits).
CONTRACT = (
    "\n\n---\n**Gameplay-harness contract (required):** keep `window.__doom` "
    "current and extend `doom/e2e/doom.spec.ts` with a Playwright assertion that "
    "FAILS on the pre-change code and PASSES after — assert the STATE CONTRACT, "
    "never pixels. Use the `window.__doomInternals` hooks (forceHit / forceDamage "
    "/ forcePickup) for deterministic outcomes. Keep the simulation a deterministic "
    "fixed-timestep step decoupled from render. CI runs build + e2e; both must be "
    "green to merge. Touch only `doom/**` (+ shared config when a slice needs it) — "
    "no edits to pacman/ or galaga/."
)

# (title, body, type, loe, priority)  — strict linear order; each non-first slice
# is blocked-by the immediately-preceding issue (topological-sound).
SLICES = [
    ("First-person movement + mouselook + wall collision",
     "Wire WASD/arrows to move the player (camera) over the floor plane and "
     "mouse (pointer-lock) + arrow keys to turn. Clamp to the playfield and stop "
     "at walls. Update `__doom.player.{x,z,yaw,pitch}` each fixed step.\n\n"
     "**Acceptance:** e2e presses forward and asserts `player.z` (or x) changed; "
     "drives the player into a wall and asserts it does NOT pass through.\n"
     "**Scope:** `doom/src/game/engine.ts`, `doom/src/game/input.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Level map + geometry (rooms & corridors)",
     "Encode a small level as a grid/sector map constant in a new "
     "`doom/src/game/level.ts` (walls, floor, ceiling, player spawn). Build the "
     "wall meshes from it and drive collision from the map (not a hard-coded box). "
     "Spawn the player at the map's start.\n\n**Acceptance:** e2e asserts the "
     "player spawns inside bounds and a known wall cell blocks movement.\n"
     "**Scope:** `doom/src/game/level.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Hitscan weapon — fire, ammo, raycast hit",
     "Fire on Space/click: cast a ray from the camera, find the nearest enemy hit "
     "(three.js `Raycaster`), and decrement `__doom.weapon.ammo` per shot (no fire "
     "at 0 ammo). Record the hit so the death slice can consume it.\n\n"
     "**Acceptance:** e2e fires and asserts `weapon.ammo` dropped; a shot aligned "
     "at an enemy registers a hit (hp drop or a hit flag).\n"
     "**Scope:** `doom/src/game/engine.ts`, `doom/src/game/types.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Enemy AI — idle → chase → attack",
     "Give an enemy a simple state machine: `idle` until it sees the player, then "
     "`chasing` (move toward the player along the floor, blocked by walls), then "
     "`attacking` when in range. Surface `enemies[i].state` transitions.\n\n"
     "**Acceptance:** e2e places the player near an enemy and asserts the enemy's "
     "`state` advances idle→chasing and its position moves toward the player.\n"
     "**Scope:** `doom/src/game/enemy.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Enemy death + scoring",
     "A weapon hit reduces `enemies[i].hp`; at 0 the enemy enters `dead` and is "
     "removed, awarding `__doom.score`. Wire `__doomInternals.forceHit({enemyId})` "
     "to deterministically kill for the harness.\n\n**Acceptance:** e2e calls "
     "`forceHit()` and asserts the enemy reaches `dead`/is removed and `score` rose.\n"
     "**Scope:** `doom/src/game/enemy.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Player damage + death → game-over",
     "An attacking enemy in range reduces `player.health` (armor absorbs a share "
     "first). At 0 health set `player.alive=false` and `status` → `lost`→`gameover`. "
     "Wire `__doomInternals.forceDamage({amount})`.\n\n**Acceptance:** e2e calls "
     "`forceDamage({amount:1000})` and asserts `player.alive===false` and a terminal "
     "`status`; a smaller hit just lowers `health`.\n"
     "**Scope:** `doom/src/game/engine.ts`, `doom/src/game/types.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P1"),

    ("Pickups — health / armor / ammo",
     "Place pickups in the level; walking over one applies it (health/armor/ammo "
     "up) and flips `pickups[i].taken=true`. Wire `__doomInternals.forcePickup({id})`.\n\n"
     "**Acceptance:** e2e calls `forcePickup()` (or walks onto one) and asserts "
     "`taken` flipped and the matching `player`/`weapon` stat rose.\n"
     "**Scope:** `doom/src/game/engine.ts`, `doom/src/game/types.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:S", "priority:P2"),

    ("Enemy variety + projectile (fireball) attack",
     "Add a 2nd/3rd enemy kind (`imp`/`demon`/`baron`) with distinct hp/speed; a "
     "ranged kind spawns `projectiles` (`from:'enemy'`) that travel and damage the "
     "player on contact. Player weapon may also spawn `from:'player'` projectiles.\n\n"
     "**Acceptance:** e2e asserts ≥2 distinct `enemies[].kind` exist and a ranged "
     "enemy produces a `projectiles[]` entry with `from==='enemy'`.\n"
     "**Scope:** `doom/src/game/enemy.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P2"),

    ("Doors + level exit → next stage",
     "Add proximity-opening doors (`doors[i].open` flips when the player is near) "
     "and a level-exit cell: reaching it advances `__doom.stage` and loads the next "
     "map (reset enemies/pickups).\n\n**Acceptance:** e2e moves the player to a "
     "door and asserts `open` flips; reaching the exit asserts `stage` incremented.\n"
     "**Scope:** `doom/src/game/level.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P2"),

    ("HUD + crosshair",
     "Render the DOM HUD (health / armor / ammo / score) mirroring `__doom`, plus "
     "a centered crosshair over the canvas. Mirror-only (read the contract), like "
     "galaga's HUD.\n\n**Acceptance:** e2e asserts the `[data-hud=\"health\"]` / "
     "`ammo` cells reflect `__doom` after damage/firing, and a crosshair element "
     "exists.\n**Scope:** `doom/src/main.ts`, `doom/index.html`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:S", "priority:P2"),

    ("Procedural wall/floor/ceiling textures (CanvasTexture)",
     "Generate textures in code (no asset files): paint to an offscreen canvas and "
     "wrap as `THREE.CanvasTexture` materials for walls/floor/ceiling. Keeps the "
     "studio asset-autonomous.\n\n**Acceptance:** e2e asserts a wall mesh's material "
     "carries a non-null `map` (texture) after load.\n"
     "**Scope:** `doom/src/game/textures.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),

    ("Enemy models — code-built low-poly geometry",
     "Replace the placeholder `BoxGeometry` enemies with low-poly models BUILT IN "
     "CODE (a `THREE.Group` of merged primitives per kind) — still no external "
     "assets. Distinct silhouette per `kind`.\n\n**Acceptance:** e2e asserts an "
     "enemy's scene object is a multi-mesh `Group` (childCount > 1), not a single "
     "box.\n**Scope:** `doom/src/game/models.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),

    ("Enemy animations — AnimationMixer clips",
     "Drive enemy models with a `THREE.AnimationMixer` + named clips "
     "(idle/walk/attack/death) generated procedurally (keyframe tracks in code). "
     "The active clip follows `enemies[i].state`.\n\n**Acceptance:** e2e asserts a "
     "mixer exists with the expected named clips and the clip switches when an "
     "enemy's `state` changes (e.g. via forceHit → death).\n"
     "**Scope:** `doom/src/game/models.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),

    ("Weapon viewmodel + muzzle flash",
     "Add a first-person weapon viewmodel (code-built mesh) fixed to the camera, "
     "with a muzzle-flash light/sprite on fire and a small recoil/bob.\n\n"
     "**Acceptance:** e2e asserts a viewmodel object is parented to the camera and "
     "a flash flag/state pulses on a fire input.\n"
     "**Scope:** `doom/src/game/viewmodel.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),

    ("Lighting + fog atmosphere",
     "Replace flat lighting with atmosphere: `THREE.Fog`, multiple lights, and "
     "per-sector light levels for the Doom mood. Keep it deterministic + perf-sane.\n\n"
     "**Acceptance:** e2e asserts `scene.fog` is set and more than one light exists "
     "in the scene.\n**Scope:** `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:S", "priority:P2"),

    ("Procedural SFX (WebAudio synth) — weapon / enemy / pickup",
     "Synthesize sound effects in code via the WebAudio API (no audio files): a "
     "weapon shot, enemy hit/death, pickup. Gate behind a first-gesture unlock "
     "(autoplay policy).\n\n**Acceptance:** e2e asserts an `AudioContext` is created "
     "and a sound node is triggered on a fire/hit event (assert the wiring, not "
     "audio output).\n**Scope:** `doom/src/game/audio.ts`, `doom/src/game/engine.ts`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),

    ("Touch controls — mobile look / move / fire",
     "Add on-screen controls for touch devices: a move stick, a look drag region, "
     "and a fire button — dispatching the SAME intents as keyboard/mouse. Responsive "
     "canvas in landscape.\n\n**Acceptance:** e2e in a touch viewport performs a "
     "move-stick drag and asserts the player moved; taps fire and asserts ammo "
     "dropped.\n**Scope:** `doom/src/game/input.ts`, `doom/src/main.ts`, `doom/index.html`, `doom/e2e/doom.spec.ts`.",
     "type:feature", "loe:M", "priority:P2"),

    ("Polish + title / restart (hit flash, screen shake, title screen)",
     "Title screen (→ playing on first input), restart after game-over, plus feel: "
     "a damage flash, hit feedback, and a brief screen shake on impact. Confirm the "
     "`base:'/doom/'` production build for game.oodim.com/doom/.\n\n**Acceptance:** "
     "`npm run build` green; e2e asserts the title→playing transition and a restart "
     "resets `status`/`score`/`health`.\n**Scope:** `doom/src/main.ts`, "
     "`doom/src/game/engine.ts`, `doom/index.html`, `doom/e2e/doom.spec.ts`.",
     "type:enhancement", "loe:M", "priority:P2"),
]

def main():
    # Resume-safe: query existing [Doom] issues (titles already seeded) and skip
    # them, chaining blocked-by from the last one. (The first run created slices
    # 1-3 then a Windows cp1252 print crashed — the issues are real, the crash
    # was cosmetic.) Match each SLICE by its "[Doom] <title>" against what exists.
    code, items = req("GET", "/issues?state=all&per_page=100&labels=agent-filed")
    existing = {}
    if code == 200:
        for i in items:
            t = i.get("title", "")
            if t.startswith("[Doom] ") and "pull_request" not in i:
                existing[t] = i["number"]
    print(f"Found {len(existing)} existing [Doom] issue(s) — resuming.")

    print("Ensuring labels…")
    ensure_label("agent-filed", "5319e7", "Picked up by the oodim autonomous pipeline")
    ensure_label("type:feature", "0e8a16", "New user-facing capability")
    ensure_label("type:enhancement", "c5def5", "Improvement to existing behavior")
    ensure_label("loe:S", "c2e0c6", "Small effort")
    ensure_label("loe:M", "fbca04", "Medium effort")
    ensure_label("priority:P1", "e99695", "User-facing gap")
    ensure_label("priority:P2", "ededed", "Enhancement / polish")
    ensure_label("by:mara", "1d76db", "Filed by Mara Okonkwo")

    print("Creating issues in order…")
    prev_num = None
    for title, body, typ, loe, prio in SLICES:
        full = f"[Doom] {title}"
        # Resume: if this slice already exists, adopt it as the chain link + skip.
        if full in existing:
            prev_num = existing[full]
            print(f"  #{prev_num}  {full}  (exists, skip)")
            continue
        labels = ["agent-filed", typ, loe, prio, "by:mara"]
        if prev_num is not None:
            ensure_label(f"blocked-by:{prev_num}", "b60205", "Gated until the blocker issue closes")
            labels.append(f"blocked-by:{prev_num}")
        code, issue = req("POST", "/issues", {
            "title": full,
            "body": body + CONTRACT,
            "labels": labels,
        })
        if code != 201:
            print(f"  ! failed ({code}): {issue}")
            sys.exit(1)
        prev_num = issue["number"]
        blk = f"  blocked-by:{labels[-1].split(':')[1]}" if labels[-1].startswith("blocked-by") else "  (head)"
        # ASCII-safe print (Windows console is cp1252; avoid em-dash/arrow crashes).
        safe = full.encode("ascii", "replace").decode("ascii")
        print(f"  #{prev_num}  {safe}{blk}")

    print("\nDone. Ordered DOOM backlog seeded — the pipeline drains the head first.")

if __name__ == "__main__":
    main()

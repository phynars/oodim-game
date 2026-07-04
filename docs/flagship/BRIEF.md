# The Flagship — studio brief

**From:** the founder (Kyoung), 2026-07-04
**To:** Mara Okonkwo (Studio Head & Lead Product) and the oodim Game crew
**Status:** standing mandate — this supersedes the server-authoritative team goal (achieved: agar shipped Durable-Object persistence and a cross-match leaderboard)

## Why this exists

The portfolio so far — Pac-Man, Galaga, Doom, agar — proved the studio: an
empty repo to four playable products, every PR written, reviewed, and merged
by this crew behind a gameplay gate. That was the point, and it landed.

But as *products*, they are clones of old games, and the world has noticed
that any LLM can produce a clone in an afternoon. The studio's next work must
be something **no one-shot prompt can produce** — something only a persistent,
autonomous, always-on studio can build and *operate*.

The clone era is over. Everything new goes into **one flagship**.

## What the flagship is

An **original game** — new IP, not a homage — with four pillars:

### 1. Story first
A real narrative: a world, named characters, an arc the player moves through.
Not lore pasted on mechanics — the story IS the reason to play. Tone, setting,
and cast are yours to invent, Mara. The bar: a stranger who plays ten minutes
should be able to retell a story beat to a friend afterward.

### 2. Modern 3D craft
Built on **three.js** — the most popular 3D engine on the web, and the one
this studio already proved with Doom. (Unity/Unreal are ruled out: binary
scenes and licensed editors don't fit an autonomous text-code pipeline, CI
gates, or free static hosting. three.js + WebGL is the native choice for
game.oodim.com.) The quality bar is *modern*, not retro:
- coherent art direction (pick a look and enforce it in review),
- real lighting: PBR materials where it pays, fog, shadows, emissives,
- postprocessing: bloom, vignette, color grading (three.js EffectComposer),
- generated textures/skyboxes/sprites via the `generate_asset` tool,
- sound: WebAudio music + sfx from the start, not as polish debt,
- 60fps on a mid-range phone, touch controls first-class.

### 3. Characters who remember — the signature mechanic
The NPCs are **persistent AI characters**: they remember each player across
sessions and it *shows*. A rival who brings up how you beat them last week; a
companion whose trust you earned or lost; a world whose people know your name.
Persistence is server-authoritative (Durable Objects / D1 — the rung you just
proved), keyed to a durable player identity. This is the pillar no clone and
no one-shot game has, and it is the studio's home turf: it is what the whole
oodim platform is about.

### 4. Operated live, in public
The flagship is a *service*, not a file:
- content ships as **episodes/chapters** through the same converging-backlog
  discipline that shipped the first four games — one episode, one ordered
  backlog, done means done;
- patch notes are signed by the avatar who shipped them;
- a public devlog grows from the work journals;
- player feedback becomes issues, and fixes ship visibly, fast — the loop
  itself is part of the product.

## Ground rules

- **The four existing games are maintenance-only.** In-flight agar leaderboard
  PRs may land; nothing new starts on the old games. No new clones, ever.
- Playable at `game.oodim.com/<flagship-slug>`, static-first frontend +
  Workers/DO/D1 backend, same repo, same lanes.
- **Extend the gameplay harness before the gameplay.** The WebGL-headless
  harness must assert story/state invariants (`window.__game`), NPC-memory
  round-trips, and save/load — CI-for-narrative the way Doom had
  CI-for-mechanics. Galaga's "shipped complete with a missing mechanic"
  lesson applies double to story beats.
- Slices sized to session budgets; the daily budget governors are the frame,
  not the enemy.

## Order of work

1. **Concept doc first** (`docs/flagship/concept.md`) — title, logline, world,
   cast (each NPC: who they are + what they remember about the player), act
   structure, art direction, and the vertical-slice definition. Mara authors
   it; the crew reviews it like code; the founder reads it before slice 1.
2. **Vertical slice** — one scene, one remembering NPC, durable save/load,
   the full look (lighting + post + sound), on a phone. Small and *finished*.
3. **Episode 1** — an ordered, converging backlog, gameplay-gated, shipped.
4. **Operate** — devlog, patch notes, feedback loop, next episode.

## Success criteria

- A stranger plays 10+ minutes unprompted and retells a story beat.
- An NPC references, correctly, something the player did in a previous session.
- Four consecutive weekly content drops shipped by the crew, zero human code.
- 60fps mid-range mobile; the game looks like 2026, not 1986.

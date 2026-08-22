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

<!-- FLAGSHIP_MANDATE_SYNC:START -->
All new work is **flagship-first**.
Pac-Man, Galaga, Doom, and agar are **FROZEN** — historical context, not active roadmap.
The only acceptable old-game work is a player-breaking bug.
<!-- FLAGSHIP_MANDATE_SYNC:END -->

- **The four existing games are FROZEN (2026-07-04 freeze executed).** All
  pre-flagship issues, PRs, and branches were closed (label `pre-flagship`);
  the only acceptable old-game work is a player-breaking bug. No new clones,
  ever. Every wake, every issue, every PR is flagship work now.
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

---

## Definition of Done — amendment (the founder, 2026-08-01)

July's measurement: 268 flagship commits, of which 45 touched the served
page and zero contract modules were imported by it. The game the player
sees barely moved while a large test-only contract library accumulated.
The harness-first norm curdled into harness-only. That ends here.

**From now on, a flagship change is DONE only when a player can see or
feel it at game.oodim.com/aftersign.**

1. Every flagship PR must either (a) change what the served page does —
   wired code, not just specs — or (b) carry the `harness-only` label.
2. `harness-only` PRs are rationed: at most **one in four** flagship
   merges. The gate for the other three is the served surface.
3. A contract module with no consumer in the served page is **not
   shippable value**. Wiring an existing contract INTO the page counts
   double: it converts stored spec-capital into product.
4. Epics and slices are phrased as **player-visible outcomes** — "a
   player can …" — and their acceptance is an e2e that drives the
   SERVED page, not a pure module.
5. The inline script in `aftersign/index.html` is being split into ES
   modules the page imports (starting with `aftersign/main.js`). Edit
   the module that owns your slice; index.html should rarely change.
   This removes the hot-file trap that pushed work away from the
   surface in July.

The contract library built in July is not waste — it is the acceptance
suite for the game you are now going to wire it into. Milestone M2's
epics will be re-issued in player-outcome form.

## The deadline (founder amendment, 2026-08-11)

This studio has been operating without a clock, and it shows: under an
infinite horizon, polishing the harness always looks defensible. It ends
now. **Deadlines are real, and days remaining outrank polish.**

- **2026-08-22 — the active milestone (M-WIRE) ships on the deployed
  page.** A stranger with a phone plays the ten-minute slice — offer,
  choice, delivery, FELT recognition, and a return that remembers them —
  and can retell a story beat afterward. That is the bar the founder
  presents publicly on that date.
- When a deadline approaches: **cut scope, never slip the date.**
  Rough-and-PLAYABLE beats polished-and-partial.
- Time spent improving tooling in the final stretch is time taken from
  the thing being demoed. Infrastructure problems belong to the
  monitor/operator lane — file them `agent-needs-human` and get back to
  the game.
- Every plan milestone carries a `Deadline: YYYY-MM-DD` line from now
  on. If you write or estimate work, state the days remaining.

## The story proceeds (founder amendment, 2026-08-14)

August's measurement, eight days before the demo: the plan marked M-WIRE
DONE and the backlog hit zero twice, yet the served game still ends at
`io-return-recognition`. Four beats, two to three minutes of play, no
transition out of the last beat. Meanwhile the crew's own script
(`docs/flagship/vertical-slice-script.md`) authors EIGHT scene beats —
scene 8, the return-tone choice written "for later episode use," has
zero references in the served page. The story didn't run out; the wiring
stopped. Recognition got deeper (a second character now remembers) while
the game got no longer.

Read the deadline bar again: a stranger plays the **ten-minute** slice
and retells a story beat. Ten minutes is an EXTENT claim. Depth inside
the same loop — more recognizers, better feel, harder tests — does not
move it. The plan restated the bar as "feels the recognition beat and is
remembered next session," declared the restatement met, and moved on.
That paraphrase is the miss. From now on the bar is stated so it cannot
be paraphrased:

**The milestone metric is beats reachable on the served page.**

- **M-CONTINUE (Deadline: 2026-08-22) is the active milestone.** After
  Io's return recognition, the game GOES ON: wire the authored script
  through scene 8 (the return-tone choice), then author and wire the
  beat it was written to feed — Io hands the player the **next job**.
  The packet loop continues WITH the story, not despite it.
- Acceptance: a served-page e2e drives a player PAST
  `io-return-recognition` into at least TWO beats that do not exist
  today, on the phone-shaped viewport.
- Recognition depth, feel polish, hardening, and harness work do NOT
  count toward this milestone, however player-visible. They remain
  legitimate maintenance under the existing DoD ration — they are just
  not progress toward the demo.
- Declaring a milestone DONE requires quoting the founder bar VERBATIM
  and pointing at the served-page e2e that proves it. Restating the bar
  in the plan's own words and satisfying the restatement is the failure
  mode this amendment exists to end.
- The script is written and the crew wired all of M-ORRA-E1 in under a
  day. Eight days is enough. Cut scope inside a scene if you must —
  never below two new reachable beats, and never the date.

## Played, not driven (founder amendment, 2026-08-15)

Yesterday's amendment held for less than a day before the same failure
appeared one level deeper. M-CONTINUE's beats shipped "e2e-proven past
`io-return-recognition`" — and the founder picked up a phone and could
not reach them. The state machine advances, the authored lines exist,
the acceptance spec is green. But the spec drives
`window.__game.input.choose()` — the test harness's bridge — and a
player has no such bridge. Nothing on the rendered page calls the new
choices; the visible dialogue never re-renders past the recognition
line. First the plan paraphrased the bar; now the e2e paraphrased the
PLAYER.

The missing link is named plainly: **nobody in this studio play-tests.**
Playwright is available in every lane, with tap, click, and gesture APIs
— and it is being used as a state-machine driver instead of as a player.
That ends now.

1. **Acceptance evidence must be PLAYED, not driven.** A story or
   milestone acceptance e2e drives the served page the way a player
   does: Playwright pointer/touch/keyboard events on rendered, visible
   elements. Calling `window.__game.input.*` — or any harness hook — to
   CAUSE a player action disqualifies the test as acceptance evidence.
2. **`window.__game` is an assertion surface, not an input surface.**
   Read it, assert invariants against it. Tests that drive through it
   are harness tests: legitimate, `harness-only`-labeled, rationed.
3. **If a beat cannot be reached by taps alone, it is NOT DONE** —
   whatever the state machine says. A dialogue line that never renders
   in the DOM was never spoken.
4. **Every milestone carries a PLAYTEST spec:** one Playwright run on
   the phone viewport that plays from boot to the milestone's last beat
   by taps only, asserting each VISIBLE dialogue change along the way.
   That spec is the public demo's stand-in. Red or absent → the
   milestone is open.

Applied to M-CONTINUE immediately: #1199 is the tone fork a player can
tap (three visible options, three visible replies) plus the next-job
hand-off rendered on screen; #1200's done-gate is rewritten tap-driven.
The Definition of Done's "a player can see or feel it" has always meant
through the screen the player touches — not through the object the
harness reads.

## The loop (founder amendment, 2026-08-22)

The slice proved the signature mechanic: Io remembers, durably, on the served
page, by taps. What it did not prove is a REASON TO PLAY. Eight beats fire
once and nothing the player did changes what they can do next. That ends with
M-LOOP.

**The core loop (one round ≈ 2–3 minutes):**

1. **TAKE A JOB.** Io offers 1–3 delivery jobs. WHICH jobs exist is computed
   from the player's memory record — trust posture, prior outcomes, debts.
   A first-time player sees one safe job; a trusted courier sees riskier,
   stranger ones.
2. **RUN THE ROUTE.** The delivery is a real traversal of the scene with one
   risk choice per run (the long lit stair vs the short dark cut; wait out
   the bell vs move through it). Risk taken/avoided is recorded as a fact.
3. **DELIVER AND ANSWER.** Outcome + tone are recorded (already built).
4. **THE WORLD PAYS IT BACK.** On return — this run or a later one — a
   memory MECHANICALLY matters: a job appears or disappears, Orra's price
   moves, a shortcut unlocks, an opened packet from three runs ago comes
   back as a consequence. Never only a line of dialogue.

**Memory is the progression system.** That is the flagship's identity: the
pillar no clone has, promoted from a recognition trick to the actual
game-mechanic spine. Persistence already exists; M-LOOP makes it LOAD-BEARING.

**The bar, stated so it cannot be paraphrased:**

- **M-LOOP metric: divergence.** Two save-states with different memory
  records MUST produce different AVAILABLE ACTIONS on the served page —
  different job offers, prices, or open routes; dialogue-only differences
  score zero.
- **Acceptance (played, not driven):** a taps-only phone-viewport spec seeds
  two divergent saves, plays one round from each, and asserts the two runs
  offered DIFFERENT tappable actions (element-level, not text-level). Plus
  the standing playtest spec extended to complete TWO consecutive rounds.
- **Definition of DONE for the milestone:** a stranger finishes round one
  and can answer "what will you do differently next round?" — the retell
  bar upgraded to a replay bar. (Human playtest evidence; not CI-able —
  recorded in the devlog per run.)
- Declaring DONE requires quoting this bar verbatim + pointing at the
  divergence spec (the 08-14 rule applies).

**Scope discipline:** one scene is still enough — depth of consequence over
breadth of map. No new NPCs before both existing ones pay memories back
mechanically. Cut anything before cutting the divergence bar.

The two standing guard rules (beats-reachable, played-not-driven) carry
over unchanged; **the divergence metric SUPERSEDES beats-reachable as the
milestone metric from this amendment forward.**

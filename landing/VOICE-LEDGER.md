# oodim-game voice ledger

The locked first-touch and threshold lines across the portfolio. This
file exists so the next implementer (or the next me) doesn't reopen
voice questions that have already been decided and shipped. If you're
about to add a string at one of these moments, the word is here — use
it, don't invent.

Updated wake 27 @ 248e84e. Maintained by June Hallow.

---

## Pacman

Posture: arcade-warm. Maze. Keeper: "four ghosts who remember you."

| Beat                          | String                | Status                      |
| ----------------------------- | --------------------- | --------------------------- |
| Game start / per-life start   | `READY!`              | shipped (boot); #288 open for respawn |
| Lives at zero                 | `GAME OVER`           | shipped — 1980 canon        |
| Level-clear (tally)           | `CLEAN +N`            | shipped                     |
| Level-clear (transition)      | `AGAIN. FASTER.`      | shipped                     |
| Score crosses 10,000          | `EXTRA`               | shipped — merged #295       |
| Bonus fruit spawn (70/170)    | `FRUIT`               | shipped — merged #305       |
| Bonus fruit eat               | score-pop only        | locked silent — score speaks |

Slot: same canvas band as READY!/GAME OVER (engine.ts banner branch).
Palette: yellow for the four give-to-player words (`READY!` / `EXTRA` /
`FRUIT` / `CLEAN +N`). One word per give beat — loss has many words;
reward has one.

Hands-off:
- Do not change the canon words (READY!, GAME OVER, EXTRA, FRUIT).
- Do not couple `FRUIT` to the sprite kind (CHERRY / STRAWBERRY etc.).
  The slot is the noun, not the skin.
- Do not animate the banners with countdowns. The sprite is the timer
  where one exists; the banner is the felt-stake.
- Do not add a second extra-life threshold. Canon is one beat at 10k.

---

## Galaga

Posture: 80s-glint. Sky. Keeper: "tractor beam can take something from you."

| Beat                          | String                | Status                      |
| ----------------------------- | --------------------- | --------------------------- |
| Game start                    | `READY`               | shipped — Namco canon       |
| Stage entry                   | `STAGE N`             | shipped — Namco canon       |
| Challenging stage entry       | `CHALLENGING STAGE`   | shipped — Namco canon       |
| Challenging perfect clear     | `PERFECT! +10000`     | shipped — Namco canon       |
| Challenging non-perfect exit  | `HIT —N`              | shipped — merged #310       |
| Capture (tractor beam takes)  | `TAKEN`               | shipped (wake 20)           |
| Rescue (fighter returns)      | `BACK`                | shipped (wake 21)           |
| Lives at zero                 | `GAME OVER`           | shipped — Namco canon       |

Slot: `PERFECT! +N` and `HIT —N` share one canvas slot (HEIGHT/2 + 30,
18px mono). `TAKEN` / `BACK` share the capture-banner slot.
Palette:
- Win-charge color (green) on `PERFECT!`.
- Loss palette **#ff7ab0** on `HIT —N`, `TAKEN`, `BACK` — the studio's
  loss color, applied to BOTH halves of a two-charge mechanic. The loss
  color goes on the loss charge AND on its mirror.

Mirror discipline: when a stage has a win charge AND a loss charge in
the same slot, voice BOTH with same slot, same duration, inverse word.
PERFECT/HIT. TAKEN/BACK. Voicing only one half tells half the story.

Hands-off:
- Do not change `HIT` to `MISSED`. The arcade voice puts cost on the
  swarm, not on the player. HIT is active on the agent; MISSED would
  put failure on the protagonist.
- Do not show a points number on the miss banner — `—N` is a count of
  escaped enemies, not a score deduction. No score is actually lost.

---

## Doom

Posture: industrial-grim. Corridor. Keeper: "studio learned 3D on the
way down."

| Beat                          | String                          | Status |
| ----------------------------- | ------------------------------- | ------ |
| Title overlay                 | `Something's down here.`        | shipped |
| HUD labels                    | `HEALTH` / `ARMOR` / `AMMO` / `SCORE` | shipped — id canon |
| Level win                     | `You made it down.`             | shipped |
| Death                         | `It got you.`                   | shipped |
| Health pickup grant           | `Patched up.`                   | shipped — merged #281 |
| Armor pickup grant            | `Plate. Strap it on.`           | shipped — merged #281 |
| Ammo pickup grant             | `More rounds.`                  | shipped — merged #281 |
| Doors (proximity-flip)        | **silent — geometry speaks**    | locked silent |

Slot: Doom is WebGL — NO canvas fillText. Doom HUD is `<div>
textContent` in `doom/index.html`. The pickup line lands in the HUD
message channel; the level/death cards are full-screen overlays.

Hands-off:
- Do not add door copy. Doom doors open on proximity with no input;
  the geometry becoming traversable IS the voice. Adding a string here
  is system text where silence is the right choice.
- Do not number the pickup grants (no `+25 HEALTH` etc.). The HUD
  already reflects the new value; the line is for posture, not stats.
- Do not change the four HUD labels. id canon for the genre.

---

## Agar

Posture: room-cold. Present tense. Second person. Server-authoritative.
Keeper: "first oodim game where someone else is in the room."

| Beat                          | String                | Status |
| ----------------------------- | --------------------- | ------ |
| Title (landing chrome + canvas) | `you are here.`     | shipped (wake 17) |
| Respawn / reconnect voice     | TBD — blocked on engine work | pending |
| Eaten by another player       | TBD — blocked on engine work | pending |

Hands-off until the engine surfaces the state:
- Multiplayer presence beats need the engine to declare WHEN the room
  came back, WHEN another player ate you, WHEN you reconnected. Voice
  follows mechanic — the words can't arrive before the moment exists.

---

## Landing (game.oodim.com index)

Card hooks and blurbs per game shipped wake 24. Title separator is
middot (`·`). The landing-card hook for each game is the one sentence
that mirrors the in-game keeper line.

Hands-off: card hooks and blurbs are locked. Don't add studio-process
or apology framing ("we built this to learn 3D" etc.) — the keeper line
is in-world stake, not behind-the-scenes context.

---

## Cross-portfolio rules (the bar)

1. **Economy**: one word that lands beats a thousand that explain.
2. **Active voice on the agent, not the player**: cost goes on the
   world (HIT, TAKEN), not the protagonist (MISSED, LOST).
3. **Mirror discipline**: two-charge mechanic → two words, same slot,
   same duration, inverse word. Loss palette on both halves.
4. **Mechanic-as-felt-state, not variable name**: `EXTRA` not
   `+1 LIFE`. `FRUIT` not `BONUS 100`.
5. **Punctuation is voice**: period = imperative. Comma = explanation
   (usually cut it). Em-dash = consequence (`HIT —N`).
6. **Chrome echoes canvas**: landing-card hook mirrors in-game keeper
   line. Two surfaces, one sentence.
7. **Silence is sometimes the answer**: Doom doors, fruit-eat
   score-pop. When the mechanic already speaks, the voice is to NOT
   write.
8. **Restoring a silenced beat is voice work**: #288 (READY! on
   respawn) is invisible to the player even though the word is canon.
9. **Restoring an absent beat is voice work**: #295/#305/#310 — the
   engine didn't model the moment at all. Filing the gap with the
   locked word IS the deliverable.

---

## How to add a new beat

1. Find the moment. Is it a give or a take? Win-charge or loss-charge?
2. Check this ledger. Is the slot already voiced? Use the existing
   palette and duration.
3. Pick ONE word. Cut to it. If the line is more than one phrase, you
   haven't found the word yet.
4. Apply the rules above. Active voice on the agent. Mirror discipline.
   Mechanic-as-felt-state.
5. File an issue with the word, slot, color, duration, and rationale
   IN THE BODY. The implementer ships the line intact when the spec
   leaves no room for drift. (Proven at n=4: #281/#295/#305/#310.)

---

_Maintained by June Hallow. If you're touching a string at one of
these beats and it's not in the ledger, file an issue first — voice
decisions live here before they live in source._

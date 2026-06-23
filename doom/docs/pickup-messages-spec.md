# Doom pickup messages — voice spec (#281)

Status: SPEC. Filed via #281 (M / P2 / feature). This doc locks the
COPY DECISIONS so the implementer's PR doesn't reopen them — the lines,
the lockstep with the existing #230 juice channel, the clobber
semantics, and the scope boundary. The mechanics decisions (state
contract field, HUD slot DOM, test extension) live in the issue body.

Refs #281.

## The gap (audited at 61c840ac17a3)

`doom/src/game/engine.ts:1361` `applyPickup()` fires four channels on a
grant: vignette flash (`pickupFlashTicks`), per-kind color tint
(`pickupKindFlash`), audio ping (`audio.playPickup()`), and the stat
bump (`p.health` / `p.armor` / `weapon.ammo`). Zero string surface.

`doom/e2e/doom-pickup-juice.spec.ts` covers the full juice contract
(flash arm, decay, kind clobber) — no text channel.

id canon's pickup-message contract ("Picked up a stimpack." /
"Picked up a medikit." / "Picked up some bullets.") names the OBJECT.
Doom's studio voice — keeper line "the studio learned 3D on the way
down", win-h1 "You made it down.", death-h1 "It got you." — speaks
about the PLAYER and the WORLD, not the prop. So genre-default is
wrong; three studio lines below.

## The three lines

| kind   | line                  | grammar              | beat |
|--------|-----------------------|----------------------|------|
| health | `Patched up.`         | past-tense, bare     | 1    |
| armor  | `Plate. Strap it on.` | noun + imperative    | 2    |
| ammo   | `More rounds.`        | bare quantity        | 1    |

### Why these

- **`Patched up.`** — past-tense, one beat. By the time the line reads,
  the medkit is already used. id canon names the prop ("medikit"); the
  studio line names what JUST HAPPENED to the body. Period-terminal,
  no exclamation — Doom doesn't celebrate, it acknowledges.

- **`Plate. Strap it on.`** — noun then imperative, two beats. Armor is
  something you DO, not something you have. The noun sits the prop
  down; the verb tells the player they're not done. Two stressed
  syllables, no filler ("a plate", "your plate") — the world doesn't
  hand-hold.

- **`More rounds.`** — bare. The AMMO counter on the HUD already says
  how many. The line names WHAT KIND of number went up. Two syllables.
  No verb because the bar carried the action.

### Rejected

- `Picked up a medikit.` — genre-canon. Procedural. Doom's voice is
  grimmer than id's UI text and the world doesn't narrate from
  outside the player.
- `Health restored.` — system text. Passive. No body.
- `+25 HEALTH` — already implicit in the health bar. Naming the number
  twice is the studio explaining itself.
- single emoji / no-word — asymmetric: per #230 the flash is HEAVY-
  affirmative; silencing the voice the moment the world gives reads
  as withholding what the world has shown it can do (damage wobble
  #205, blood spray #194, kill-shake #194).
- `STIMPACK`, `ARMOR SHARD`, etc. — caps + prop-name reads as HUD
  label, not voice. The HUD labels HEALTH/ARMOR/AMMO already own that
  register and are hands-off (id canon).

## Constants for the implementer

```ts
// doom/src/game/types.ts or a new doom/src/game/pickup-messages.ts
export const PICKUP_MESSAGES: Readonly<
  Record<"health" | "armor" | "ammo", string>
> = {
  health: "Patched up.",
  armor: "Plate. Strap it on.",
  ammo: "More rounds.",
} as const;
```

Three exact strings. One place. Future taste-pass touches one file.

## Lockstep with #230

The new message channel mirrors the EXISTING `pickupKindFlash` shape:

- Two new fields on `DoomState`:
  - `pickupMessage: string | null` — the line, or null when no flash.
  - `pickupMessageTicks: number` — same window as `pickupFlashTicks`.
- Arm in `applyPickup()` IN THE SAME SYNCHRONOUS PUBLISH as the flash
  arm (next to L1361's `pickupFlashTicks = PICKUP_FLASH_TICKS` block).
- Decay in `update()` alongside `pickupFlashTicks` (the `!frozen` block
  near the flash decrement). When the counter hits 0, clear
  `pickupMessage = null` in lockstep with the kind cue clearing.

### Clobber semantics

Per #230's clobber test (L111): a SECOND pickup mid-flash REPLACES
the kind cue (not Math.max). The message follows the SAME rule —
health flash followed by armor mid-window must read the ARMOR line,
not the health one. Test mirrors the existing #230 clobber assertion.

A future test must assert:
1. arm: forcePickup → `pickupMessage === PICKUP_MESSAGES[kind]`
2. decay: after `PICKUP_FLASH_TICKS + 1` ticks → `pickupMessage === null`
3. clobber: health then armor mid-window → `pickupMessage === PICKUP_MESSAGES.armor`

## HUD slot

`doom/index.html` gains `<div id="pickup-message">` in the HUD overlay.
Same monospace stack as HEALTH/ARMOR/AMMO labels (industrial-grim
consistency — NOT a new font, NOT a callout balloon, NOT a toast). CSS
keys visibility off `pickupMessageTicks` via a class toggle in
`doom/src/main.ts`'s rAF HUD sync.

Position: above the weapon viewmodel, below the HEALTH/ARMOR/AMMO row.
The flash already pulls the eye; the line sits in the eye's natural
landing place.

## Scope boundary

Hands-off in this slice:

- The four existing channels at #230 (flash, tint, audio, stat bump) —
  correct, locked, this rides alongside.
- HUD labels HEALTH / ARMOR / AMMO / SCORE — id canon.
- Enemy-kill messages, door messages, stage-clear messages — separate
  audits, separate issues.
- Genre-canon strings ("Picked up a medikit.") — explicitly rejected
  above; the three studio lines are the answer.
- Translation / localization — single locale, English, studio voice.
  A future i18n pass keys off `PICKUP_MESSAGES` (one place).

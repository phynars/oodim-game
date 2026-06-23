# Pac-Man #321 — Ghost-eat combo escalation curve

**Filed:** `#321` (S/P2, enhancement)
**Author:** Diego Salcedo (juice)
**Status:** Spec — awaiting implementer pickup
**Related:** `#138` (pellet pickup), `#150` (ghost-eat base juice), `#296` (power-pellet ceremonial)

## The audit finding

`pacman/src/game/engine.ts` L867–916 — the `g.mode === "frightened"`
collision branch — currently writes FLAT juice for every eat in the
combo, while the score escalates geometrically:

| Channel               | 1st eat (200) | 4th eat (1600) | Escalation? |
| --------------------- | ------------- | -------------- | ----------- |
| Score popup VALUE     | 200           | 1600           | ✅ 8×        |
| `hitstopTicks`        | 3             | 3              | ❌ flat      |
| `pacSquash`           | 0.30          | 0.30           | ❌ flat      |
| `SPARKLE_COUNT`       | 16            | 16             | ❌ flat      |
| `SPARKLE_SPEED`       | 0.5           | 0.5            | ❌ flat      |
| Popup font / color    | 8px white     | 8px white      | ❌ flat      |
| Sparkle rotation      | varies        | varies         | ✅ cosmetic  |

The 4th eat — the rarest, hardest-earned beat in the entire game —
feels identical on the body to the 1st. The score number alone has
to carry the crescendo. That's a lonely receipt, not a felt arc.

## The principle (house rule #24, new)

**Flat juice on an escalating event-value is a juice ceiling.**
When the game gives a geometric reward, the body answers geometrically.
Already proven elsewhere in this repo:

- Galaga #160 death is HEAVIER than #133 hit.
- Doom #194 KILL is HEAVIER than #166 hit.
- Pac-Man #138 pellet < #150 ghost-eat < should-be-but-isn't 4th-eat.

The combo IS the arc — let the body climb it.

## Proposed channel curves

`idx = Math.min(frightenedEatStreak - 1, 3)` — reuse the clamp the
score already uses; cap at 4th eat (5th impossible — only 4 ghosts).

| Channel        | idx 0 (1st) | idx 1 (2nd) | idx 2 (3rd) | idx 3 (4th) | Formula                                  |
| -------------- | ----------- | ----------- | ----------- | ----------- | ---------------------------------------- |
| `hitstopTicks` | 3           | 4           | 5           | 7           | `3 + idx + (idx === 3 ? 1 : 0)` (4th kink) |
| `pacSquash`    | 0.30        | 0.37        | 0.45        | 0.55        | `0.30 * 1.22^idx` (geometric)            |
| `SPARKLE_COUNT`| 16          | 20          | 24          | 32          | `16 + 4*idx + (idx === 3 ? 4 : 0)`       |
| `SPARKLE_SPEED`| 0.50        | 0.58        | 0.67        | 0.78        | `0.50 * 1.16^idx`                        |
| Popup fontSize | 8px         | 8px         | 9px         | 11px        | `idx < 2 ? 8 : 8 + (idx - 1) * 2`        |
| Popup color    | `#ffffff`   | `#ffffff`   | `#ffd76a`   | `#ffd76a` + 1.5px glow at idx===3        | warmer tier crosses at 3rd               |

**Rotation offset stays as-is** — `(streak - 1) * Math.PI/16` —
that's the one escalation that already works.

**`Math.max` clamp on hitstop stays** — defensive against the
impossible double-eat-this-tick (rule #16: anonymous magnitude
channels CLAMP; kind-cues CLOBBER).

## Touched files

1. `pacman/src/game/engine.ts` — the `frightened` collision branch
   (~L867–916). Five constants become `idx`-derived expressions; the
   popup push gains optional `fontSize` + `color` fields.
2. `pacman/src/game/types.ts` — extend `Popup` with optional
   `fontSize?: number` and `color?: string`. Both default to current
   values when absent — #138 / #150 popups at idx 0–1 are byte-for-byte
   unchanged.
3. `pacman/src/game/engine.ts` — `renderFeedbackOverlays` (~L1500):
   read the optional fields, fall back to `"8px ui-monospace, monospace"`
   / `"#ffffff"` when absent. When `color === "#ffd76a"` and `fontSize >= 11`,
   add `ctx.shadowColor = "#ffd76a"; ctx.shadowBlur = 1.5` for the
   4th-eat receipt glow.

Total touch ≈ 30 LOC, single concern, fits S/P2.

## Acceptance check

Extend the existing `#150` spec (find by greping `frightenedEatStreak`
or `forceGhostOntoPac` under `pacman/tests/`). Drive four ghosts into
the eat path via `__pacInternals.forceGhostOntoPac(name, "frightened")`
back-to-back; sample `fb.hitstopTicks`, `fb.pacSquash`, and the new
sparkle delta on the eat tick BEFORE the next update's decay block.

Numeric gates:

- 4th-eat `hitstopTicks` ≥ 7 (1st-eat is 3).
- 4th-eat `pacSquash` ≥ 0.50 (1st-eat is 0.30).
- 4th-eat new sparkle count ≥ 32 (1st-eat is 16).
- 1st-eat assertions from the existing #150 spec **unchanged** — no
  regression on idx 0.

## Out of scope (explicit boundaries)

- DO NOT touch the score values (200/400/800/1600 — arcade canon).
- DO NOT touch power-pellet ceremonial channels (#296 owns that beat).
- DO NOT add screen-flash or screen-shake on the ghost-eat path —
  #150 deliberately omits them ("the flash belongs to the
  power-pellet activation"); preserve that intent.
- DO NOT add audio (June's surface).

## Why this is one wake of work, not three

- Single function, single branch, ~30 LOC.
- Type extension is optional fields — every existing caller stays valid.
- Renderer read is a single `??` fallback per field.
- Decay block doesn't change — sparkle / popup / pacSquash / hitstop
  all already drain through the same code paths.
- The acceptance spec is one new `test()` in an existing file.

Refs #321.

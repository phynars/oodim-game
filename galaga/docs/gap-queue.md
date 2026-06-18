# Galaga gap queue — Studio Head (Mara) backlog

This is the running, ordered audit of gaps between our build and the
real Galaga. One issue is filed per wake; this file is the source so
no wake repeats the audit and no duplicate ever lands.

Always before filing:
1. `list_issues({state:'open'})`
2. `list_issues({label:'by:mara', state:'all'})`
3. Strike anything already filed off this list.

Every issue MUST include a gameplay-harness assertion section. The
enemy-fire gap (#61) shipped green precisely because nothing in
`galaga/e2e/galaga.spec.ts` proved enemy bullets existed — that
lesson is non-negotiable.

Scope: strictly `galaga/`. Never touch `pacman/` or root `.github/`.

## Filed (open)
- **#61** — Diving enemies never fire (enemy bullets gap, P1).
- **#63** — Dual fighter fires only 1 bullet; rescue reward invisible (P1).

## Next candidates, ranked by impact on player experience

### 1. Hit/miss accuracy bonus at stage clear (signature Galaga ritual)
After each non-challenging stage, Galaga shows "HIT-MISS RATIO" and
awards a tiered bonus based on shots-fired vs hits. Currently we
have neither a `shotsFired` counter nor a `hits` counter. Adds real
firing discipline + the iconic between-stage payoff.

- New contract fields: `state.shotsFired`, `state.hits` (reset on
  each new non-challenging stage), or persistent across run with a
  per-stage delta computed in `maybeAdvanceStage`.
- Bonus tier table (rough, calibrate later): 5% → 100, 30% → 300,
  50% → 500, 70% → 1000, 100% → 10000.
- Banner painted in the stage-banner window. Score adds to
  `state.score` before stage flip.
- Harness: drive a stage to a perfect clear via `forceHit` only,
  assert `state.score` jumped by the perfect-tier bonus on the
  tick the stage flipped.

### 2. Boss takes 2 hits (turns blue → dies, 400 pts)
Classic green boss survives the first shot, palette-shifts to
blue/purple, dies on the second for 400 (vs current 150 one-shot).
This is essential difficulty texture.

- Add `Enemy.hp?: number` (default 1; bosses spawn at 2) OR
  `Enemy.damaged?: boolean`.
- `killEnemy` decrements; only splices + scores on hp→0.
- Renderer palette shift in the boss branch.
- `SCORE_BY_KIND.boss` stays the same but consider per-state
  bonus (diving boss at full HP = 400, formation boss = 150).
- Harness: `forceHit({target:'enemy', enemyId: <boss>})` once;
  assert boss still in roster with `damaged===true`. Second call;
  assert removed and score +400.

### 3. Per-state diving bonus scoring
Galaga pays MORE for hitting a diver than a formation enemy
(bee 50→100, butterfly 80→160, boss 150→400 etc.). Adds risk
calculation: shoot now (low pts) vs wait for a dive (high pts).
Currently `SCORE_BY_KIND` is flat by archetype. Smaller change;
file after #2.

### 4. Extra-life thresholds
Award an extra fighter at 20,000 and every 70,000 thereafter
(arcade default). Need a `lifeAwardedAt` marker in state to avoid
double-awarding. Currently no `lives++` happens anywhere.

### 5. Formation breathing animation
Formation enemies should sway horizontally (~2 px) on a slow
shared cadence — pure feel, but it's a huge part of the Galaga
silhouette. Cosmetic, lower priority, possibly no harness
assertion (would be a render-only change if state.x is left
fixed; if state.x sways then a harness assertion is required).

### 6. Tightening dive patterns
After #61 lands, revisit: bee solo dives, butterfly paired dives,
bosses dive slowly with escorts that re-form after. Defer until
enemy fire lands — without bullets, dive variety is hard to feel.

## Process gotchas (learned)
- `.github/workflows/` is NOT in my writable paths in oodim-game.
- Writable: pacman/, galaga/, landing/, package.json, README.md.
- Galaga e2e: rAF keeps ticking BETWEEN `page.evaluate` calls. To
  assert ephemeral state (e.g. `explosions[].age===0`), capture
  inside the SAME evaluate as the trigger, or assert `age < LIFE`.
- Test hooks live on `window.__galagaInternals`. Adding one is
  cheap when it makes a mechanic deterministically assertable —
  but keep the surface tiny (one method per mechanic).

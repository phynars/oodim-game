# Handoff: routeRiskTouchFeedback parallel-contract rejection (Refs #1848)

PR #1955 revision **deletes** `aftersign/src/routeRiskTouchFeedback.js`
and its consumer test `apps/web/src/aftersign/routeRiskTouchFeedback.consumer.test.ts`.

Soren's REQUEST_CHANGES review was correct on every axis. This is the
**fifth** repetition of the parallel-feel-contract pattern already
documented in `HANDOFF-1694.md`, `HANDOFF-1698.md`, `HANDOFF-1760.md`,
and `HANDOFF-1848.md`. Read `HANDOFF-1848.md` first — the resolution
here is identical; this note only records what was specific to #1955.

## What the rejected draft was

`aftersign/src/routeRiskTouchFeedback.js` — a "route-risk touch
feedback" DOM writer + resolver that:

- Exported `getRouteRiskTouchFeedback(routeRisk)` returning
  `{ pressScale, liftPx, durationMs }` keyed on `"low" | "medium" | "high"`.
- Exported `applyRouteRiskTouchFeedback(button, routeRisk)` which
  installed a scoped `<style>`, stamped `data-aftersign-route-risk-touch`
  and three `--aftersign-route-risk-touch-*` CSS custom properties on
  the button, and toggled `.is-aftersign-route-risk-touch-pressing`
  for `durationMs` via `setTimeout`.
- The module's own header claimed it "runs at click-time from the
  offer / route-risk callback in `aftersign/main.js`."

The consumer test drove the module through jsdom directly and asserted
the installed `<style>`, stamped attribute, CSS vars, and the pressed-
class round-trip on fake timers.

## Why deletion, not wiring

The shipped route-choice confirmation envelope already exists in the
form Soren has repeatedly pinned:

1. **`aftersign/src/routeRiskConfirmFeedback.js`** — the canonical
   route-choice confirmation envelope. Web Animations API,
   `prefers-reduced-motion` branch (brightness-only flicker for the
   vestibular contract), try/catch so decorative feedback can't break
   the durable route commit, boolean return so callers can gate haptics.
   Pinned by `apps/web/src/aftersign/routeRiskMemory.ts:50-62` and
   Soren's REQUEST_CHANGES on #1840. Numbers:
   `durationMs: 180`, `liftPx: 4`, `scalePeak: 1.025`,
   `easing: "cubic-bezier(.2,.8,.2,1)"`, `hapticPulseMs: 8`.
2. **`packages/aftersign/src/interactionConfirm.ts`** — the shared
   press cue contract, pinned by
   `apps/web/src/aftersign/interactionConfirm.test.ts`.

`routeRiskTouchFeedback.js` re-modeled the same interaction with a
different vocabulary and different numbers on every axis:

| Concern                     | routeRiskTouchFeedback.js (rejected)              | Shipped `routeRiskConfirmFeedback.js`                          |
|-----------------------------|---------------------------------------------------|----------------------------------------------------------------|
| Vocabulary                  | `pressScale` / `liftPx` / `durationMs`            | `scalePeak` / `liftPx` / `durationMs` (+ `easing`, `hapticPulseMs`) |
| Press-scale numbers         | `0.982` / `0.974` / `0.966` per-risk              | `scalePeak: 1.025` (LIFT, not press-DIP; one axis, not three)  |
| Duration                    | `96ms`                                            | `180ms` (pinned)                                               |
| Animation primitive         | `<style>` install + `setTimeout` class toggle     | Web Animations API (`element.animate(...)`)                    |
| Reduced-motion branch       | (absent)                                          | brightness-only flicker (vestibular contract)                  |
| Try/catch around DOM writes | (absent)                                          | wraps `.animate(...)` so decorative feedback can't throw       |
| Boolean success return      | returns the feel envelope object                  | returns `boolean` so callers can gate haptics                  |
| Risk-axis vocabulary        | `routeRisk: "low" \| "medium" \| "high"`          | single envelope; risk lives on the choice, not the press cue   |

The `96ms` vs `180ms` and `0.966` press-dip vs `1.025` lift split are
not tuning variance — they are two different animations claiming to be
the "route-risk press acknowledgement." Merging them would install a
second source of truth on top of Soren's pinned surface and the
vestibular reduced-motion branch would silently vanish for any player
routed through the new writer.

The reviewer explicitly cited both pinned contracts (`interactionConfirm.ts`
/ `routeRiskConfirmFeedback.js`) as the surfaces the module diverged
from, tagged AI002 (divergent one-off vocabulary) and AI006 (unconsumed
surface — `aftersign/main.js` never imported it), and noted that the
consumer test drove jsdom directly rather than the served surface.

## Orphan axes (all three, again)

1. **Zero shipped consumers.** `aftersign/main.js` does not import
   `applyRouteRiskTouchFeedback` or `getRouteRiskTouchFeedback`. The
   module header claiming it runs "at click-time from the route-risk
   callback in `main.js`" was aspirational; no edit to `main.js`
   accompanied the module.
2. **No served CSS reads the vars.** The `--aftersign-route-risk-touch-*`
   custom properties and `.is-aftersign-route-risk-touch-pressing`
   class exist only inside the `<style>` block the module installs.
   No stylesheet in `aftersign/index.html` or under `aftersign/`
   references them, and no other component reads them.
3. **Consumer test drove jsdom directly, not the served surface.**
   The test imported `applyRouteRiskTouchFeedback` and called it on a
   raw jsdom `<button>` — it never rendered through
   `renderRouteRiskChoice` (the served-page writer at
   `apps/web/src/aftersign/routeRiskMemory.ts:188`), so the assertion
   proves only that the module writes what it writes, not that any
   player-visible surface ever reads it.

## The correct next step (unchanged from HANDOFF-1694 / -1698 / -1760 / -1848)

If we want an EXPLICIT press-feedback envelope on route-risk button
taps that varies with risk axis, do NOT build a sixth parallel module.
Options, in order of preference:

1. Extend `aftersign/src/routeRiskConfirmFeedback.js` to accept an
   optional `routeRisk` axis and derive `scalePeak` from it, keeping
   `durationMs: 180`, the reduced-motion branch, and the try/catch
   intact. Update `ROUTE_RISK_CONFIRM_FEEL` to expose the risk-axis
   table if per-risk tuning is authored. One contract, one caller
   set, no drift.
2. Or extract a shared `playConfirmFeedback` in
   `aftersign/src/confirmFeedback.js` and have both the packet-intent
   fork and the route-risk fork import it, with the reduced-motion +
   try/catch discipline preserved.
3. In either case, wire the change through the existing
   `renderRouteRiskChoice({...})` click handler at
   `apps/web/src/aftersign/routeRiskMemory.ts:50-62` so the wire lives
   next to the served render, not in a sibling module the served page
   never imports. Add the consumer test as a sibling to
   `routeRiskMemory.consumer.test.ts` so drift reds on the served
   render path, not a jsdom-only fixture.

None of that lands in this PR — this PR is strictly the deletion.

## What this PR does

- Deletes `aftersign/src/routeRiskTouchFeedback.js`.
- Deletes `apps/web/src/aftersign/routeRiskTouchFeedback.consumer.test.ts`.
- Removes the deleted test from `apps/web/src/aftersign/vitest.config.ts`.
- Adds this handoff at `apps/web/src/aftersign/HANDOFF-1955.md`.

## What this PR does NOT do

- Does NOT modify `aftersign/main.js`, `routeRiskConfirmFeedback.js`,
  `routeRiskMemory.ts`, `interactionConfirm.ts`, or any other shipped
  surface.
- Does NOT add a route-risk press-feedback envelope — that is a design
  question that deserves its own scoped PR anchored on the shipped
  contracts.

## Note to future-me

**Five** repetitions in a row (#1694, #1698, #1760, #1848, now #1955)
all had the same shape: a "pure feel module" landed under
`aftersign/src/` (or `apps/web/src/aftersign/`) with no shipped
consumer, an aspirational header claiming a `main.js` wire that was
never actually made, and numbers that diverged from the pinned
`routeRiskConfirmFeedback.js` / `interactionConfirm.ts` contracts.
The consumer rule remains decisive: **nothing ships until the served
surface imports it and a jsdom test proves it renders on the right
frame** — and doubling down by adding the `main.js` wire in the
review-response iteration only widens the divergence, because the
new module still diverges on `reduced-motion`, `try/catch`, and the
scale-peak vocabulary the pinned surface has locked.

The next feel change I ship for route-risk press starts by editing
`routeRiskConfirmFeedback.js` and the `renderRouteRiskChoice` render
site TOGETHER, in the same PR, with a `routeRiskMemory.consumer.test.ts`
sibling that pins the risk-axis behavior.

Refs #1848

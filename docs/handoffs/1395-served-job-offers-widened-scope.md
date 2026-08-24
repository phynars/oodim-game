# Hand-off: #1395 needs WIDENED scope — served-page job-offer renderer does not exist on main

**Session:** meta-moderator chunk 2, repo snapshot `a74a35640a70` (main).
**Status:** #1395's spec is partially invalid; do NOT execute it verbatim.

## What was confirmed this session (all from tool reads at a74a356)

1. **No served-page job-offer surface exists.** A repo-wide grep for
   `offeredJobs|job-offer` matches only 4 files, all under
   `apps/web/src/aftersign/` (harness projection `bootWindowGame.ts` +
   tests). A scoped grep under `aftersign/` returns ZERO matches across
   173 files. Therefore:
   - `aftersign/main.js` has NO `computeOfferedJobs` import and no renderer.
   - `aftersign/index.html` has NO `#offeredJobs` container.
   - `aftersign/e2e/job-offers-played.spec.ts` does not exist yet.
   #1393/#1395 assume PR #1390 wired the primitive into the served page and
   only *reachability* is broken — that wiring is NOT on main. The two
   routing edits + spec from #1395 alone would ship a permanently-red e2e
   asserting buttons nothing renders.

2. **Restore branch** (in `reloadFromSave`, `aftersign/main.js`):
   ```js
   state.scene.beat = typeof saved.beat === "string"
     ? canonicalFlagshipBeat(saved.beat)
     : state.packet.delivered ? "packet-delivered" : "packet-offered";
   ```

3. **Loop re-entry** (in `choose()`, `deliver-packet` branch at
   `io-next-job`): resets `state.packet` to
   `{ delivered: false, route: null, sealed: true, deliveredAt: null }`,
   resets `delivery.outcome`/`secondAction`, then `setBeat("packet-choice")`.
   It does **NOT** clear `state.npcs.io.memory` — a `delivery-outcome`
   fact (minted by `deliverPacket()`) survives the loop. That surviving
   fact is the natural served-page analog for `priorOutcome: "completed"`;
   no new persistence code is needed (memory already round-trips via the
   persist payload).

4. **Primitive** (`packages/aftersign/src/computeOfferedJobs.ts`):
   completed branch returns `["job-night-transfer", "job-signed-receipt"]`;
   default returns `["job-safe-delivery"]`. Scope forbids changing it.

## Exact implementation plan (next /code session, from main)

1. `edit aftersign/index.html` — add a hidden container beside `#routeChoice`:
   `<div id="offeredJobs" data-visible="false"></div>`.
2. `edit aftersign/main.js` imports — add near the routeRiskMemory import:
   `import { computeOfferedJobs } from "../packages/aftersign/src/computeOfferedJobs";`
3. `edit aftersign/main.js` `renderText()` — when
   `state.scene.beat === "packet-offered"`, render one
   `<button id="job-offer-<id>" data-aftersign-tap-choice="<id>">` per id in
   `computeOfferedJobs(state.npcs.io.memory.some((f) => f?.kind === "delivery-outcome") ? { priorOutcome: "completed" } : undefined)`
   into `#offeredJobs`; clear children + `data-visible="false"` off-beat
   (mirror the `#routeRiskChoice` pattern already in `renderText()`).
4. `edit aftersign/main.js` `choose("deliver-packet")` io-next-job branch —
   `setBeat("packet-choice")` → `setBeat("packet-offered")` so the loop
   re-enters the offer beat with memory intact (#1393 acceptance).
5. `edit aftersign/e2e/m-continue-next-packet-loop.spec.ts` — READ IT FIRST;
   update its `packet-choice` re-entry pin to `packet-offered`.
6. `write aftersign/e2e/job-offers-played.spec.ts` — real-tap path (no
   harness input): deliver → return → tone → ask-for-next-job →
   "Deliver next packet" tap; assert `#job-offer-job-night-transfer` and
   `#job-offer-job-signed-receipt` render and `#job-offer-job-safe-delivery`
   is absent.

## Hard constraints (carried from #1394's failure)

- NEVER full-`write` `aftersign/main.js` (~3234 lines, over the write
  budget — that is exactly what killed PR #1394). Targeted `edit`s only.
- Do NOT touch `packages/aftersign/src/computeOfferedJobs.ts` or the
  harness projection (`bootWindowGame.ts` / `windowGameSurface.ts`).
- End the implementing session's reply with `Closes #1395, Refs #1393`.
  This doc is a spec, not the fix — it Refs only.

Refs #1395, Refs #1393.

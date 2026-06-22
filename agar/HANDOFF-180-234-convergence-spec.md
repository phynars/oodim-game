# Agar #180 / #234 — drop-in scaffold for `multiplayer-convergence.spec.ts`

**Status:** Refs #180, Refs #234. NOT a fix — a precise implementer scaffold.

## Why a scaffold instead of the spec itself

This wake's exploration budget covered three of the four files needed
to write the spec safely without fabrication:

- ✅ `agar/e2e/multiplayer-smoke.spec.ts` — the template (waitForFirstSnapshot helper, ROOM_URL, ctx pattern).
- ✅ `e2e-shared/multiplayer/playwright-binding.ts` — confirmed exports: `assertClientSurface`, `canonical`, `driveTape`, `expectConverge`, `disconnect`, `reconnect`, `readAppliedLog`, `expectOrderingInvariant`.
- ✅ `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md` — exists, names the four break modes.
- ❌ `agar/e2e/tick.spec.ts` — NOT read this wake. This is where the
  agar-side `pureReplay(seed, tape)` import path is established. Without
  reading it the spec would have to guess `import { pureReplay } from
  "../src/?"` and risk a broken import landing in a PR.

So this doc lists every line of the spec with the two unknowns marked.
The implementer (or wake-24 me) reads exactly one file
(`agar/e2e/tick.spec.ts`) to resolve `TODO(impl-1)`, and one file in
`agar/server/` to land `TODO(impl-2)` (the `DESYNC_BROKEN` path).
Everything else is already verified against the snapshot at
`5363cce`.

## Why `expectOrderingInvariant` is NOT used

Verified against `playwright-binding.ts` (the file in this snapshot):
`expectOrderingInvariant` requires `appliedLog` elements to match
`/^\d+:[^:]+:\d+$/` (`tick:clientId:seq`). Agar slice 2 ships
`InputDir[]` (literal strings like `"up"`, `"none"`), so
`expectOrderingInvariant` would throw its shape-mismatch error against
agar — the binding's comment block calls this out explicitly.

The ordering invariant #234 acceptance bullet 1 actually wants is:
**`pureReplay(SEED, appliedLog)` equals `canonical` on EACH page**.
That's the per-page idiom (same as agar/e2e/tick.spec.ts uses for the
single-client case) — different from the tape-driven `pureReplay(tape,
SEED)` literally written in #234, because agar's `appliedLog` is the
authoritative ordered input log, not the tape (the tape is what we
sent; appliedLog is what the DO actually applied). When they equal up
to per-tick collapse, the invariant holds.

## Drop-in spec — `agar/e2e/multiplayer-convergence.spec.ts`

```ts
// Two-client convergence + ordering + reconnect — the merge gate
// proof for #180. Sits alongside multiplayer-smoke.spec.ts: smoke
// proves the binding loads; this spec proves the rung.
//
// Acceptance coverage (from #234):
//   1. Ordering: pureReplay(SEED, appliedLog) === canonical on each page.
//   2. Reconnect-replay: B disconnects mid-tape, A drives more, B reconnects,
//      both pages' canonical converge AND each equals pureReplay over its log.
//   3. Failing fixture: DESYNC_BROKEN=1 turns ordering bullet 1 red.
//      (Server-side path lives in agar/server/ — separate file, this spec
//      runs the same in either CI polarity.)
//   4. Zero waitForTimeout — gates are tickTo / data-tick poll only.

import { expect, test, type Page } from "@playwright/test";
import {
  assertClientSurface,
  canonical,
  driveTape,
  disconnect,
  reconnect,
  readAppliedLog,
  expectConverge,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { Tape } from "../../e2e-shared/multiplayer/harness";
// TODO(impl-1): RESOLVE THE IMPORT PATH by reading agar/e2e/tick.spec.ts.
// That spec already calls pureReplay against agar's reducer in the
// single-client case. Mirror its import line verbatim. Likely shapes:
//   import { pureReplay } from "../src/reducer";
//   import { pureReplay } from "../src/sim/replay";
// DO NOT GUESS — open tick.spec.ts and copy the working import.
import { pureReplay } from "TODO_IMPORT_PATH_FROM_TICK_SPEC";

const SEED = "42";
const ROOM_URL = `/agar/?seed=${SEED}`;

// Identical helper to multiplayer-smoke.spec.ts. Factored locally
// rather than imported because the smoke is read-only per #234 scope.
async function waitForFirstSnapshot(page: Page): Promise<void> {
  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect
    .poll(
      async () =>
        Number(
          await page.getByTestId("agar-net-status").getAttribute("data-tick"),
        ),
      { message: "first snapshot from DO" },
    )
    .toBeGreaterThan(0);
}

async function readClientId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const g = (window as unknown as { __game: { clientId: unknown } }).__game;
    const v = g.clientId;
    return typeof v === "function" ? (v as () => string)() : (v as string);
  });
}

test.describe("agar · multiplayer convergence (the rung)", () => {
  test("ordering: pureReplay(SEED, appliedLog) === canonical on both pages", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);
      await Promise.all([
        waitForFirstSnapshot(pageA),
        waitForFirstSnapshot(pageB),
      ]);
      await assertClientSurface(pageA);
      await assertClientSurface(pageB);

      const [idA, idB] = await Promise.all([
        readClientId(pageA),
        readClientId(pageB),
      ]);

      // Distinct inputs across several ticks. If the DO mis-orders,
      // pureReplay over the appliedLog will not equal canonical even
      // though canonical might still converge between pages (both wrong
      // the same way). This is why ordering is a per-page invariant,
      // not just a pairwise convergence check.
      const tape: Tape<string> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "up" },
        { tick: 4, clientId: idB, seq: 1, input: "down" },
        { tick: 6, clientId: idA, seq: 2, input: "none" },
        { tick: 6, clientId: idB, seq: 2, input: "none" },
      ];
      await driveTape([pageA, pageB], tape);

      await expectConverge([pageA, pageB]);

      for (const page of [pageA, pageB]) {
        const [log, state] = await Promise.all([
          readAppliedLog(page),
          canonical(page),
        ]);
        const replayed = pureReplay(SEED, log);
        expect(replayed).toStrictEqual(state);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("reconnect-replay: B drops mid-tape, A continues, B catches up", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);
      await Promise.all([
        waitForFirstSnapshot(pageA),
        waitForFirstSnapshot(pageB),
      ]);
      const [idA, idB] = await Promise.all([
        readClientId(pageA),
        readClientId(pageB),
      ]);

      // Phase 1: both alive.
      const tape1: Tape<string> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
      ];
      await driveTape([pageA, pageB], tape1);

      // Phase 2: B disconnects, A drives more inputs solo.
      await disconnect(pageB);
      const tape2: Tape<string> = [
        { tick: 5, clientId: idA, seq: 1, input: "up" },
        { tick: 8, clientId: idA, seq: 2, input: "none" },
      ];
      await driveTape([pageA], tape2);

      // Phase 3: B reconnects; DO replays missed state.
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);

      await expectConverge([pageA, pageB]);

      const [logB, stateB] = await Promise.all([
        readAppliedLog(pageB),
        canonical(pageB),
      ]);
      expect(pureReplay(SEED, logB)).toStrictEqual(stateB);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
```

## Remaining server-side work (separate PR, blocks #234 / #180 close)

1. `agar/server/<the-DO-file>.ts` — add a `DESYNC_BROKEN` env-gated path
   that drops every 7th input. Mirror the `HARNESS_BREAK_MODE` env
   approach Soren documented in
   `e2e-shared/multiplayer/FIXTURE-DESYNC-BROKEN.md`.
2. `.github/workflows/agar-multiplayer-fixture-redgreen.yml` — run this
   spec twice: once against main DO (green), once with `DESYNC_BROKEN=1`
   set on the worker build (red). Both polarities required.

These two pieces are honestly out of safe DIY range from a /code wake
that hasn't read the DO source — they ship as a follow-up PR by an
implementer who has server-side context.

## Verification once the spec lands

- `grep waitForTimeout agar/e2e/multiplayer-convergence.spec.ts` → no matches.
- Local: `pnpm -F agar test:e2e` → both tests green against main.
- CI: the red/green job lights red against `DESYNC_BROKEN=1` and green
  against main. A spec that's green in both polarities is broken — it
  isn't exercising its guard.

## Wake-24 (or next implementer) starting move

1. `read agar/e2e/tick.spec.ts` — copy the `pureReplay` import line
   verbatim into `TODO(impl-1)`.
2. `write agar/e2e/multiplayer-convergence.spec.ts` from the block above
   with the import resolved.
3. Open PR with `Refs #234, Refs #180`. Do NOT `Closes` — bullet 3
   (DESYNC_BROKEN server) and the CI red/green workflow are still owed.
4. File the server-fixture follow-up issue once this spec is in main.

_Mara, wake 23. Refs #180, #234._

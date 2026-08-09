// Story-state + NPC-memory + durable save/load contract for the
// aftersign vertical slice — asserted against the REAL served
// `window.__game` surface published by aftersign/index.html.
//
// PRIOR REJECTION (Mara, PR #1097 review):
//   The first draft of this file waited on
//   `window.__game.restoreDurableSave / meetNpc / getStoryState /
//   getRecallTrigger`. Those methods only exist on
//   `bootAftersignWindowGame` (apps/web/src/aftersign/harness/
//   bootWindowGame.ts) which is used solely by the JSDOM unit test
//   windowGameHarnessBoot.test.ts. The served /aftersign/ page (built
//   from aftersign/index.html + aftersign/main.js) publishes a
//   different surface: `input.choose / input.forceSave /
//   input.forceReload / input.waitForStoryIdle / getSnapshot`. Waiting
//   on the wrong methods hangs the spec to timeout and turns the
//   aftersign lane red on every PR (same failure mode as the earlier
//   io-recognition-player-visible-feel.spec.ts). Fixed by re-anchoring
//   every assertion to the surface the served page ACTUALLY publishes,
//   as pinned by flagship-reload-beat-regression.spec.ts and
//   flagship-surface-contract.spec.ts.
//
// What this spec pins that isn't already covered elsewhere:
//   • A single-shot contract test that stitches story-state +
//     NPC-memory + durable-save into ONE round trip: play → forceSave
//     → forceReload → assert the story beat, delivery outcome, AND
//     Io's remembered fact all rehydrate together.
//   • Existing coverage:
//       - durable-save-load.spec.ts guards the durable envelope
//         (slot/revision) across forceSave→forceReload, but does NOT
//         assert story beat or NPC memory content.
//       - flagship-reload-beat-regression.spec.ts guards the reloaded
//         beat + Io recognition line, but the story/state/memory
//         invariants aren't asserted as a single contract snapshot.
//     This spec fuses them: one snapshot, one set of expectations,
//     one failure surface if any leg regresses.
//
// State-quiesced — waitForFunction + waitForStoryIdle, no wall-clock
// waits (per e2e-shared/no-wall-clock-waits).
import { expect, test, type Page } from "@playwright/test";

// Narrow Window.__game surface — just the fields this spec touches.
// TypeScript global augmentations merge across files but Playwright's
// per-file esbuild transpile strips types, so runtime is unaffected;
// keeping the type narrow avoids drift with FlagshipGameSurface.
declare global {
  interface Window {
    __game?: {
      version?: number;
      scene: { beat: string };
      delivery: { outcome: string };
      npcs: {
        io: {
          lastLine?: string | null;
          memory: Array<{ id?: string; object?: string; action?: string }>;
        };
      };
      input: {
        choose: (choiceId: string) => void | Promise<void>;
        forceSave: () => void | Promise<void>;
        forceReload: (options?: { clearLocalState?: boolean }) => void | Promise<void>;
        waitForStoryIdle: () => void | Promise<void>;
      };
      getSnapshot: () => StorySnapshot;
    };
  }
}

type StorySnapshot = {
  scene: { beat: string };
  delivery: { outcome: string };
  npcs: {
    io: {
      lastLine?: string | null;
      memory: Array<{ id?: string; object?: string; action?: string }>;
    };
  };
};

const WAIT_MS = 10_000;

async function waitForSurface(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__game?.getSnapshot === "function" &&
      typeof window.__game?.input?.choose === "function" &&
      typeof window.__game?.input?.forceSave === "function" &&
      typeof window.__game?.input?.forceReload === "function" &&
      typeof window.__game?.input?.waitForStoryIdle === "function",
    undefined,
    { timeout: WAIT_MS },
  );
}

async function idle(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.input.waitForStoryIdle());
}

async function snapshot(page: Page): Promise<StorySnapshot> {
  return page.evaluate(() => window.__game!.getSnapshot());
}

test("story beat + Io memory + delivery outcome all rehydrate together after forceSave/forceReload", async ({
  page,
}) => {
  await page.goto("./");
  await waitForSurface(page);

  // Baseline: fresh session — nothing delivered, no Io memory.
  const baseline = await snapshot(page);
  expect(baseline.delivery.outcome).toBe("unknown");
  expect(baseline.npcs.io.memory.length).toBe(0);

  // Play the sealed-packet path to the durable "packet-delivered"
  // beat. These choice ids are the same ones pinned by
  // flagship-reload-beat-regression.spec.ts.
  for (const choiceId of ["keep-sealed", "deliver-packet"]) {
    await page.evaluate((id) => window.__game!.input.choose(id), choiceId);
    await idle(page);
  }

  const beforeReload = await snapshot(page);
  // The 1180ms setTimeout may or may not have promoted us to
  // "io-return-recognition" by the time we save — both beats are
  // contract-valid pre-save (see #958 note in
  // flagship-reload-beat-regression.spec.ts). What must be durable is
  // the delivery outcome and the Io memory entry recording it.
  expect(["packet-delivered", "io-return-recognition"]).toContain(beforeReload.scene.beat);
  expect(beforeReload.delivery.outcome).toBe("sealed");
  expect(beforeReload.npcs.io.memory.length).toBeGreaterThan(0);
  expect(beforeReload.npcs.io.memory.some((m) => m.object === "sealed")).toBe(true);

  // Persist and simulate a full page reload — this is the round trip
  // the vertical slice must survive.
  await page.evaluate(() => window.__game!.input.forceSave());
  await page.evaluate(() => window.__game!.input.forceReload());
  await waitForSurface(page);
  await idle(page);

  // After reload: story-state, delivery-outcome, and NPC-memory all
  // present, all consistent. This is the contract — three legs of the
  // vertical slice, ONE snapshot assertion.
  const afterReload = await snapshot(page);

  // Story beat: durable "packet-delivered" OR the recognition beat if
  // the timer promoted post-reload; both are contract-valid.
  expect(["packet-delivered", "io-return-recognition"]).toContain(afterReload.scene.beat);

  // Delivery outcome survived the round trip.
  expect(afterReload.delivery.outcome).toBe("sealed");

  // NPC memory survived AND still references the sealed outcome —
  // this is the "NPC remembers a prior session" invariant the flagship
  // brief calls out as slice-1 work.
  expect(afterReload.npcs.io.memory.length).toBeGreaterThan(0);
  expect(afterReload.npcs.io.memory.some((m) => m.object === "sealed")).toBe(true);
});

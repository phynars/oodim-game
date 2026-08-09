import { expect, test, type Page } from '@playwright/test';

// Served-page contract for the flagship slice.
//
// This spec pins the surface the harness-first vertical slice actually
// exposes on `/aftersign/` at runtime. It:
//
//   1. Boots the served page and waits for `window.__game` to expose the
//      input surface (choose / forceSave / forceReload / waitForStoryIdle
//      / getSnapshot).
//   2. Force-reloads with a cleared local state so the run starts from a
//      known baseline.
//   3. Reads the snapshot and asserts scene readiness + a string beat id.
//   4. Drives `choose('keep-sealed')` (a real choice id — see
//      aftersign/main.js's `Unknown AFTERSIGN choice` guard), forces a
//      save, and asserts the outcome is reflected in the snapshot.
//   5. Reloads the page + calls `forceReload()` to prove the durable
//      save reads back the same outcome.
//
// This is the served-surface complement of the in-JSDOM
// windowGameSurface.contract.test — if either the shape OR the served
// wiring drifts, exactly one of them fails.

type AftersignSnapshotNpc = {
  id?: string;
  disposition?: string;
  memory?: unknown;
};

type AftersignServedSnapshot = {
  scene?: {
    beat?: string;
    ready?: boolean;
  };
  story?: {
    beat?: string;
    currentBeatId?: string;
    memoryBeat?: {
      kind?: string;
      outcome?: string;
    } | null;
  };
  // `publishState()` in aftersign/main.js publishes `save` and `npcs` at
  // the ROOT of the snapshot, not under a `state` key. The reviewer
  // called this out on #1105 — earlier drafts nested them under `state`
  // and always read `undefined`.
  save?: unknown;
  npcs?: {
    io?: AftersignSnapshotNpc;
    orra?: AftersignSnapshotNpc;
  } | Array<AftersignSnapshotNpc>;
  input?: unknown;
};

// Choice ids match `aftersign/main.js`'s `Unknown AFTERSIGN choice`
// guard: only `keep-sealed`, `open-packet`, `deliver-packet`,
// `return-to-io`, `acknowledge-kiosk`, `skip-kiosk-acknowledge` are
// accepted. Anything else throws inside `choose()` and the spec dies
// before its assertions.
type AftersignChoiceId =
  | 'keep-sealed'
  | 'open-packet'
  | 'deliver-packet'
  | 'return-to-io'
  | 'acknowledge-kiosk'
  | 'skip-kiosk-acknowledge';

type AftersignServedGame = {
  getSnapshot?: () => AftersignServedSnapshot;
  input?: {
    choose?: (choice: AftersignChoiceId) => Promise<unknown> | unknown;
    forceSave?: () => Promise<unknown> | unknown;
    forceReload?: (options?: { clearLocalState?: boolean }) => Promise<unknown> | unknown;
    waitForStoryIdle?: () => Promise<unknown> | unknown;
  };
};

declare global {
  interface Window {
    __game?: AftersignServedGame;
  }
}

const readSnapshot = async (page: Page): Promise<AftersignServedSnapshot> => {
  return page.evaluate(() => {
    const game = window.__game;
    if (!game?.getSnapshot) {
      throw new Error('served /aftersign/ window.__game.getSnapshot is missing');
    }

    return JSON.parse(JSON.stringify(game.getSnapshot())) as AftersignServedSnapshot;
  });
};

const waitForServedHarness = async (page: Page): Promise<void> => {
  await page.goto('/aftersign/');
  await page.waitForFunction(() => {
    const game = window.__game;
    return Boolean(
      game?.getSnapshot &&
        game.input?.choose &&
        game.input?.forceSave &&
        game.input?.forceReload,
    );
  });
};

const waitForStoryIdle = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await window.__game?.input?.waitForStoryIdle?.();
  });
};

test('served page exposes the story/state surface used by the flagship slice', async ({ page }) => {
  await waitForServedHarness(page);
  await page.evaluate(() => window.__game!.input!.forceReload?.({ clearLocalState: true }));
  await waitForStoryIdle(page);

  const baseline = await readSnapshot(page);
  expect(baseline.scene?.ready).toBe(true);
  const baselineBeat =
    baseline.scene?.beat ?? baseline.story?.beat ?? baseline.story?.currentBeatId;
  expect(typeof baselineBeat).toBe('string');

  // `save` and `npcs` are published at the snapshot ROOT by
  // publishState() (see aftersign/main.js — `save: { ...state.save }`
  // and `npcs: { io: {…}, orra: {…} }` live directly on the returned
  // object). Reading them here is what pins the served shape.
  expect(baseline.save).toBeDefined();
  expect(baseline.npcs).toBeDefined();

  await page.evaluate(async () => {
    // `keep-sealed` is a real choice id per aftersign/main.js's guard.
    await window.__game!.input!.choose?.('keep-sealed');
    await window.__game!.input!.forceSave?.();
    await window.__game!.input!.waitForStoryIdle?.();
  });

  const afterChoice = await readSnapshot(page);
  expect(afterChoice.save).toBeDefined();
  const serializedAfterChoice = JSON.stringify(afterChoice);
  // The `keep-sealed` choice writes packet intent / memory refs whose
  // serialized form mentions "sealed" (per the memoryBeat outcome and
  // packet fields in main.js). Assert on that stable substring rather
  // than a specific nested path so the spec pins the served surface
  // without over-fitting to a single field.
  expect(serializedAfterChoice).toContain('sealed');

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game?.getSnapshot && window.__game.input?.forceReload));
  await page.evaluate(async () => {
    // Reload WITHOUT clearLocalState — we want the durable save to
    // restore the `keep-sealed` outcome across the page reload.
    await window.__game!.input!.forceReload?.();
    await window.__game!.input!.waitForStoryIdle?.();
  });

  const afterReload = await readSnapshot(page);
  expect(afterReload.save).toBeDefined();
  expect(afterReload.npcs).toBeDefined();
  const serializedAfterReload = JSON.stringify(afterReload);
  expect(serializedAfterReload).toContain('sealed');
});

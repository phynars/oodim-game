// Harness capability: window.__game.getSnapshot() must return an
// ISOLATED, DEEPLY-CLONED view of the story state — mutating the
// returned snapshot must NEVER leak back into the live surface.
//
// Why this test exists (Mara's REQUEST_CHANGES on PR #1054):
//   The prior revision of this file was a tombstone marker (23 lines of
//   comment + `export {};`) — it gated nothing. This replaces it with a
//   real e2e assertion on a durable-save/load-adjacent invariant that
//   is NOT already covered by a sibling spec:
//
//     - flagship-surface-contract.spec.ts (authoritative reload gate)
//       asserts save/authority/revision but does NOT probe getSnapshot's
//       isolation.
//     - durable-save-load.spec.ts (this dir) is `.describe.skip`'d
//       pending phase-3 (SwiftShader cold-start flake) — it also does
//       not check snapshot isolation.
//     - hard-navigation-save-survival-contract.spec.ts covers hard-nav
//       survival, again silent on snapshot immutability.
//
// The contract:
//   `main.js publishState()` publishes `window.__game.getSnapshot`, a
//   function that returns `clone({ ...state ... })` (a fresh
//   JSON.parse(JSON.stringify(...)) copy). If a caller mutates the
//   returned snapshot (push into an npc's `memories`, flip
//   `save.dirty`), the live `window.__game` and subsequent snapshots
//   must be unaffected. This is the invariant that lets save/load call
//   sites treat snapshots as safe wire-shaped payloads.
//
// This spec is DISCOVERED by aftersign/playwright.config.ts
// (testDir: "e2e"), runs against the served /aftersign/ surface, and
// is NOT in the testIgnore list — so it gates the lane.

import { expect, test, type Page } from '@playwright/test';

type StorySnapshot = {
  version: number;
  save: { revision: number; dirty: boolean };
  npcs: {
    io: { memories: Array<{ id: string }> };
    orra: { memories: Array<{ id: string }> };
  };
};

type StoryGame = StorySnapshot & {
  getSnapshot: () => StorySnapshot;
};

const WAIT_MS = 60_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const g = (window as typeof window & { __game?: { version?: unknown } }).__game;
      return typeof g === 'object' && g !== null && g.version === 1;
    },
    undefined,
    { timeout: WAIT_MS },
  );
}

test('getSnapshot() returns an isolated clone — mutating it does not leak into window.__game', async ({ page }) => {
  // 90s cold-start budget mirrors sibling flagship contract specs; a
  // single cold `page.goto` under SwiftShader dominates wall time here.
  test.setTimeout(90_000);

  await page.goto('/aftersign/', { waitUntil: 'load' });
  await waitForGame(page);

  const result = await page.evaluate(() => {
    const g = (window as typeof window & { __game?: StoryGame }).__game;
    if (!g) throw new Error('window.__game was not published');
    if (typeof g.getSnapshot !== 'function') {
      throw new Error('window.__game.getSnapshot is not a function');
    }

    const baseline = g.getSnapshot();
    const baselineIoLen = baseline.npcs.io.memories.length;
    const baselineOrraLen = baseline.npcs.orra.memories.length;
    const baselineDirty = baseline.save.dirty;
    const baselineRevision = baseline.save.revision;

    // Attempt to poison the snapshot. If getSnapshot leaks live refs,
    // these mutations flow into window.__game and the next snapshot.
    baseline.npcs.io.memories.push({ id: 'poison-io' });
    baseline.npcs.orra.memories.push({ id: 'poison-orra' });
    baseline.save.dirty = !baselineDirty;
    baseline.save.revision = baselineRevision + 999;

    const post = g.getSnapshot();

    return {
      baselineIoLen,
      baselineOrraLen,
      baselineDirty,
      baselineRevision,
      liveIoLen: g.npcs.io.memories.length,
      liveOrraLen: g.npcs.orra.memories.length,
      liveDirty: g.save.dirty,
      liveRevision: g.save.revision,
      postIoLen: post.npcs.io.memories.length,
      postOrraLen: post.npcs.orra.memories.length,
      postDirty: post.save.dirty,
      postRevision: post.save.revision,
    };
  });

  // Live surface stayed untouched by snapshot mutation.
  expect(result.liveIoLen).toBe(result.baselineIoLen);
  expect(result.liveOrraLen).toBe(result.baselineOrraLen);
  expect(result.liveDirty).toBe(result.baselineDirty);
  expect(result.liveRevision).toBe(result.baselineRevision);

  // A subsequent snapshot also stayed untouched (proves getSnapshot
  // doesn't cache a poisoned reference either).
  expect(result.postIoLen).toBe(result.baselineIoLen);
  expect(result.postOrraLen).toBe(result.baselineOrraLen);
  expect(result.postDirty).toBe(result.baselineDirty);
  expect(result.postRevision).toBe(result.baselineRevision);
});

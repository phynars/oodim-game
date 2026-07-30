// AFTERSIGN hard-navigation save-survival contract — pure module.
//
// This file holds the assertion + snapshot shape used by the
// `hard-navigation-save-survival-contract.spec.ts` pure-lane spec and by
// the browser-driven `durable-save-load.spec.ts` full-lane spec. It lives
// under `aftersign/src/` (not `aftersign/e2e/`) on purpose: importing
// from a `.spec.ts` file would re-execute its `test.describe`/`test`
// registrations at the importer's module top level, causing Playwright
// to discover the save-survival tests twice (once via `testMatch`, once
// via the transitive import). Keeping the pure logic in `src/` means
// consumers can `import { assertHardNavigationSaveSurvival } from
// "../src/hardNavigationSaveSurvival"` with no side effects.
//
// Only Playwright's `expect` is imported here — that's a plain
// assertion library call at runtime, not a test-registration side
// effect, so it's safe.

import { expect } from "@playwright/test";

type SaveAuthority = "server" | "local-fallback";

type LoadProof = {
  source: SaveAuthority | null;
  revision: number | null;
  playerId: string | null;
};

type SerializableSaveProbe = {
  player: {
    id: string;
  };
  save: {
    slot: string;
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
    authority: SaveAuthority;
    lastLoadProof: LoadProof;
  };
};

export const HARD_NAVIGATION_SAVE_CONTRACT_SLOT = "default";

export type HardNavigationSaveSnapshot = {
  cold: SerializableSaveProbe;
  saved: SerializableSaveProbe;
  loaded: SerializableSaveProbe;
  resaved: SerializableSaveProbe;
};

export function assertHardNavigationSaveSurvival({
  cold,
  saved,
  loaded,
  resaved,
}: HardNavigationSaveSnapshot): void {
  expect(cold.save.slot).toBe(HARD_NAVIGATION_SAVE_CONTRACT_SLOT);
  expect(cold.player.id.length).toBeGreaterThan(0);

  expect(saved.save.slot).toBe(HARD_NAVIGATION_SAVE_CONTRACT_SLOT);
  expect(saved.save.dirty).toBe(false);
  expect(saved.save.revision).toBeGreaterThanOrEqual(cold.save.revision);
  expect(saved.save.lastPersistedAt).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(saved.save.lastPersistedAt as string))).toBe(false);
  expect(saved.save.authority).toMatch(/^(server|local-fallback)$/);

  expect(loaded.save.slot).toBe(HARD_NAVIGATION_SAVE_CONTRACT_SLOT);
  expect(loaded.save.lastLoadProof).toEqual({
    source: saved.save.authority,
    revision: saved.save.revision,
    playerId: saved.player.id,
  });
  expect(loaded.player.id).toBe(saved.player.id);
  expect(loaded.save.revision).toBe(saved.save.revision);
  expect(loaded.save.lastPersistedAt).toBe(saved.save.lastPersistedAt);
  expect(loaded.save.dirty).toBe(false);
  expect(loaded.save.authority).toBe(saved.save.authority);

  expect(resaved.save.slot).toBe(HARD_NAVIGATION_SAVE_CONTRACT_SLOT);
  expect(resaved.player.id).toBe(saved.player.id);
  expect(resaved.save.revision).toBeGreaterThanOrEqual(loaded.save.revision);
  expect(resaved.save.lastPersistedAt).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(resaved.save.lastPersistedAt as string))).toBe(false);
  expect(resaved.save.dirty).toBe(false);
  expect(resaved.save.authority).toBe(loaded.save.authority);
  expect(resaved.save.lastLoadProof).toEqual(loaded.save.lastLoadProof);
}

import { expect, test } from "@playwright/test";

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

const CONTRACT_SLOT = "default";

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
  expect(cold.save.slot).toBe(CONTRACT_SLOT);
  expect(cold.player.id.length).toBeGreaterThan(0);

  expect(saved.save.slot).toBe(CONTRACT_SLOT);
  expect(saved.save.dirty).toBe(false);
  expect(saved.save.revision).toBeGreaterThanOrEqual(cold.save.revision);
  expect(saved.save.lastPersistedAt).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(saved.save.lastPersistedAt as string))).toBe(false);
  expect(saved.save.authority).toMatch(/^(server|local-fallback)$/);

  expect(loaded.save.slot).toBe(CONTRACT_SLOT);
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

  expect(resaved.save.slot).toBe(CONTRACT_SLOT);
  expect(resaved.player.id).toBe(saved.player.id);
  expect(resaved.save.revision).toBeGreaterThanOrEqual(loaded.save.revision);
  expect(resaved.save.lastPersistedAt).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(resaved.save.lastPersistedAt as string))).toBe(false);
  expect(resaved.save.dirty).toBe(false);
  expect(resaved.save.authority).toBe(loaded.save.authority);
  expect(resaved.save.lastLoadProof).toEqual(loaded.save.lastLoadProof);
}

const savedAt = "2026-07-28T00:00:00.000Z";

const passingSnapshot: HardNavigationSaveSnapshot = {
  cold: {
    player: { id: "player-io" },
    save: {
      slot: CONTRACT_SLOT,
      revision: 2,
      lastPersistedAt: null,
      dirty: false,
      authority: "server",
      lastLoadProof: { source: null, revision: null, playerId: null },
    },
  },
  saved: {
    player: { id: "player-io" },
    save: {
      slot: CONTRACT_SLOT,
      revision: 3,
      lastPersistedAt: savedAt,
      dirty: false,
      authority: "server",
      lastLoadProof: { source: null, revision: null, playerId: null },
    },
  },
  loaded: {
    player: { id: "player-io" },
    save: {
      slot: CONTRACT_SLOT,
      revision: 3,
      lastPersistedAt: savedAt,
      dirty: false,
      authority: "server",
      lastLoadProof: { source: "server", revision: 3, playerId: "player-io" },
    },
  },
  resaved: {
    player: { id: "player-io" },
    save: {
      slot: CONTRACT_SLOT,
      revision: 4,
      lastPersistedAt: "2026-07-28T00:00:01.000Z",
      dirty: false,
      authority: "server",
      lastLoadProof: { source: "server", revision: 3, playerId: "player-io" },
    },
  },
};

test.describe("AFTERSIGN hard-navigation save survival contract", () => {
  test("pins the durable reload invariants without a browser boot", () => {
    assertHardNavigationSaveSurvival(passingSnapshot);
  });
});

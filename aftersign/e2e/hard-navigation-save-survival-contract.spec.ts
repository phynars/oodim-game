import { test } from "@playwright/test";

import {
  assertHardNavigationSaveSurvival,
  HARD_NAVIGATION_SAVE_CONTRACT_SLOT,
  type HardNavigationSaveSnapshot,
} from "../src/hardNavigationSaveSurvival";

// The assertion + snapshot type live in `aftersign/src/` so other
// consumers (the browser-driven `durable-save-load.spec.ts` and the
// `flagship-runnable-slice-spine-contract.spec.ts` product-spine guard)
// can import them without transitively re-executing this file's
// `test.describe`/`test` registrations. This spec keeps only the
// pure-lane test that pins the invariants against a passing snapshot.

const savedAt = "2026-07-28T00:00:00.000Z";

const passingSnapshot: HardNavigationSaveSnapshot = {
  cold: {
    player: { id: "player-io" },
    save: {
      slot: HARD_NAVIGATION_SAVE_CONTRACT_SLOT,
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
      slot: HARD_NAVIGATION_SAVE_CONTRACT_SLOT,
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
      slot: HARD_NAVIGATION_SAVE_CONTRACT_SLOT,
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
      slot: HARD_NAVIGATION_SAVE_CONTRACT_SLOT,
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

import { test, expect } from "@playwright/test";

import {
  assertDurableSaveLoaded,
  assertSerializableFlagshipSurface,
  getFlagshipSurface,
  type FlagshipGameSurface,
} from "../../e2e-shared/flagshipStoryStateContract";

// AFTERSIGN durable save/load contract.
//
// Source of truth for the shape asserted here is
// e2e-shared/flagshipStoryStateContract.ts, which mirrors the doc at
// docs/flagship/story-state-contract.md. In particular:
//
//   - forceSave / forceReload live under `window.__game.input.*`
//     (FlagshipInput), NOT at the top level of the surface. Confirmed by
//     sibling specs flagship-surface-contract.spec.ts and
//     flagship-reload-beat-regression.spec.ts.
//   - forceSave() takes NO arguments; the save slot is fixed to
//     'default' by the spec.
//   - save.authority is 'server' | 'local-fallback'; the durable
//     vertical-slice requires 'server' after a clearLocalState reload.
//   - save.lastLoadProof carries { source, revision, playerId } — there
//     is no per-call slot field on the proof.
//
// This spec is the "durable save/load" red-first harness capability:
// force a save, force a clean reload that wipes local browser state,
// then prove the surface came back server-authoritative via the shared
// assertDurableSaveLoaded helper. Until the impl exposes the required
// fields, this spec is expected to fail — that IS the harness capability
// per the Galaga rule ("no story beat exists unless a harness assertion
// says so").

test.describe("AFTERSIGN durable save/load contract", () => {
  test("forceSave survives forceReload({clearLocalState:true}) as server-authoritative state", async ({
    page,
  }) => {
    await page.goto("/aftersign/");

    // Wait for the harness surface to publish.
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __game?: unknown }).__game),
    );

    // Snapshot the pre-save surface. It must already be a valid flagship
    // surface — if it isn't, the durable proof below is meaningless.
    const beforeSave = (await page.evaluate(() => {
      return (window as unknown as { __game: unknown }).__game;
    })) as FlagshipGameSurface;
    assertSerializableFlagshipSurface(beforeSave);

    // Force a save through the authoritative input surface.
    await page.evaluate(async () => {
      const game = (window as unknown as { __game?: FlagshipGameSurface }).__game;
      if (typeof game?.input?.forceSave !== "function") {
        throw new Error(
          "window.__game.input.forceSave must be exposed for the durable save/load harness",
        );
      }
      await game.input.forceSave();
    });

    // Force a clean reload that wipes local browser state. If the save
    // was only in localStorage/IndexedDB, this reload will lose it — the
    // whole point of the durable proof.
    await page.evaluate(async () => {
      const game = (window as unknown as { __game?: FlagshipGameSurface }).__game;
      if (typeof game?.input?.forceReload !== "function") {
        throw new Error(
          "window.__game.input.forceReload must be exposed for the durable save/load harness",
        );
      }
      await game.input.forceReload({ clearLocalState: true });
    });

    // Re-wait for the surface after reload — forceReload may swap the
    // window object entirely depending on implementation.
    await page.waitForFunction(() =>
      Boolean((window as unknown as { __game?: unknown }).__game),
    );

    const afterLoad = (await page.evaluate(() => {
      return (window as unknown as { __game: unknown }).__game;
    })) as FlagshipGameSurface;
    assertSerializableFlagshipSurface(afterLoad);

    // Shared durability proof: authority === 'server', lastLoadProof
    // sourced from server, revision continuity, flags + Io memories
    // survived, dirty === false.
    assertDurableSaveLoaded(beforeSave, afterLoad);

    // Belt-and-braces expectations against the resolved surface so a
    // failure here yields a Playwright-native message, not just an
    // Error thrown from the shared helper.
    const surface = getFlagshipSurface({ __game: afterLoad } as unknown as Window);
    expect(surface.save.slot).toBe("default");
    expect(surface.save.authority).toBe("server");
    expect(surface.save.dirty).toBe(false);
    expect(surface.save.lastLoadProof.source).toBe("server");
    expect(surface.save.lastLoadProof.playerId).toBe(beforeSave.player.id);
    expect(typeof surface.save.lastPersistedAt).toBe("string");
  });
});

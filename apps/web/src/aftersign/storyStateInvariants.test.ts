import { describe, expect, it } from "vitest";

import {
  assertSerializableFlagshipSurface,
  type FlagshipGameSurface,
} from "../../../../e2e-shared/flagshipStoryStateContract";

import { createAftersignWindowGame } from "./windowGameSurface";

// Failing-first harness assertion against the AUTHORITATIVE
// FlagshipGameSurface contract (e2e-shared/flagshipStoryStateContract.ts,
// mirroring docs/flagship/story-state-contract.md).
//
// Today, `createAftersignWindowGame().state` is an
// `AftersignVerticalSliceState` — it has `scene: 'kiosk' | 'io-return'`,
// `packetOutcome`, `ioHasMetPlayer`, `ioRecognizesPlayer`. It does NOT have
// `version`, `build.slug`, `scene.act`, `scene.beat`, `delivery.id`,
// `npcs.io`, or `save` — every field the contract requires.
//
// This test forces the vertical-slice impl to grow the window surface into
// the shared FlagshipGameSurface (or wrap the vertical-slice state in one)
// before the harness will go green. The impl PR making this pass is the
// same one the e2e spec `flagship-surface-contract.spec.ts` already
// consumes at the browser layer — this vitest is its unit-level twin,
// running in the CI's fast lane before any Playwright/WebGL cost.
//
// Contract-anchored: every field checked below traces to a rule in
// e2e-shared/flagshipStoryStateContract.ts. If the shared contract
// changes, this test moves with it — the shared helper
// `assertSerializableFlagshipSurface` is the single source of truth.
describe("AFTERSIGN story/state harness contract", () => {
  it("window game exposes a FlagshipGameSurface-shaped state snapshot", () => {
    const game = createAftersignWindowGame();

    // Cast to the target contract type. The runtime assertion below is
    // what actually enforces conformance — the cast just lets the test
    // read fields the contract requires without TS blocking on the
    // pre-impl shape.
    const surface = game.state as unknown as FlagshipGameSurface;

    // Single call, contract-anchored: throws on the first missing or
    // wrong field. Under the current impl this throws at `version !== 1`;
    // the impl PR is done when this call returns.
    assertSerializableFlagshipSurface(surface);

    // Redundant field checks so a green run is obviously legitimate —
    // if the impl ever short-circuits `assertSerializableFlagshipSurface`
    // by only satisfying its exact predicate list, these still catch the
    // most load-bearing surface identifiers (build slug, scene id/act,
    // delivery id, npc id).
    expect(surface.version).toBe(1);
    expect(surface.build.slug).toBe("aftersign");
    expect(surface.scene.id).toBe("io-night-post-kiosk");
    expect(surface.scene.act).toBe("act-1-seal");
    expect(surface.delivery.id).toBe("blue-packet");
    expect(surface.npcs.io.id).toBe("io");
    expect(Array.isArray(surface.npcs.io.memories)).toBe(true);
    expect(surface.save.slot).toBe("default");
  });
});

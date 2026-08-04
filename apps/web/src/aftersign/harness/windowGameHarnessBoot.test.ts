import { describe, expect, it } from "vitest";

import { MEMORY_RECALL_FEEL } from "../memoryRecallFeel";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "../verticalSliceState";
import "./bootWindowGame";

// #918: this file carries the ONLY assertion the aftersign vitest lane runs
// in CI today. It is deliberately isolated from the pre-existing
// `../durableSave.contract.test.ts` (and the other ~22 sibling test files)
// because those have never been executed in CI (they lived under
// `continue-on-error: true` since #836) and an unknown subset is red on
// drift. Widening the lane's `include` back to the full glob is tracked in
// #841 — until then, this file is the whole surface of the blocking lane.
describe("Aftersign window.__game harness (#918)", () => {
  it("boots window.__game and projects durable Io memory through the harness surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.version).toBe(1);

    const payload = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
      ),
      7,
    );

    game?.restoreDurableSave(payload);
    game?.meetNpc("io");

    expect(game?.getStoryState()).toMatchObject({
      story: {
        beat: "io-remembers-sealed-packet",
      },
      state: {
        npcs: [
          {
            id: "io",
            disposition: "recognizes-player",
            memory: {
              recognizesPlayer: true,
              packetOutcome: "sealed",
            },
          },
        ],
      },
    });
  });

  it("keeps durable save metadata visible after restored story progression", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const savedAtTurn = 31;
    const payload = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
      ),
      savedAtTurn,
    );

    game?.restoreDurableSave(payload);
    game?.meetNpc("io");
    game?.meetNpc("orra");

    expect(game?.getStoryState()).toMatchObject({
      story: {
        // With orraRecognizesPlayer=false and orraAction=null, the
        // resolver falls through orra branches and lands on the io
        // recognition beat driven by the restored sealed packet.
        beat: "io-remembers-sealed-packet",
      },
      state: {
        save: {
          key: "aftersign.verticalSlice.v1",
          savedAtTurn,
        },
      },
    });
    expect(JSON.parse(JSON.stringify(game?.getStoryState()))).toEqual(game?.getStoryState());
  });

  // Consumer wiring for the memory-recall feel envelope (PR #1020
  // follow-up). `getMemoryRecallFeel` used to live only inside its
  // sibling contract test — an unconsumed pure module. It is now wired
  // into `bootWindowGame.ts` so `window.__game.recallFeel(elapsedMs)`
  // samples the envelope keyed off the recognition trigger captured
  // when `meetNpc` promotes a previously-met NPC to `recognizes-player`.
  // These assertions run in the aftersign blocking lane, so the wiring
  // is guarded end-to-end.
  it("fires the memory-recall envelope only on the second meet (recognition transition)", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // First contact: no durable memory, no recall trigger.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.meetNpc("io");
    expect(game?.getRecallTrigger()).toBeNull();
    expect(game?.recallFeel({ elapsedMs: 120 })).toBeNull();

    // Return session: Io has already met the player, so this meet
    // promotes her to `recognizes-player`. That transition fires the
    // recall trigger, and `recallFeel` samples the shared envelope.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        9,
      ),
    );
    game?.meetNpc("io");

    const trigger = game?.getRecallTrigger();
    expect(trigger?.npcId).toBe("io");
    expect(typeof trigger?.firedAtMs).toBe("number");

    const recognition = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.recognizeMs });
    expect(recognition?.phase).toBe("recognize");
    expect(recognition?.captionOpacity).toBeCloseTo(1, 5);
    expect(recognition?.haloScale).toBeCloseTo(MEMORY_RECALL_FEEL.haloScalePeak, 5);

    const held = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.durationMs });
    expect(held?.phase).toBe("held");
    expect(held?.captionOpacity).toBeCloseTo(0, 5);
  });

  it("honours reducedMotion when sampling the recall envelope through the harness", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        3,
      ),
    );
    game?.meetNpc("io");

    const full = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.recognizeMs });
    const reduced = game?.recallFeel({
      elapsedMs: MEMORY_RECALL_FEEL.recognizeMs,
      reducedMotion: true,
    });

    expect(full).not.toBeNull();
    expect(reduced).not.toBeNull();
    expect(reduced!.captionLiftPx).toBeLessThan(full!.captionLiftPx);
    expect(reduced!.cameraYawDeg).toBeLessThan(full!.cameraYawDeg);
    expect(reduced!.hapticMs).toBe(0);
  });
});

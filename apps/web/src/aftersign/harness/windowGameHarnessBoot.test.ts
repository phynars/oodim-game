import { describe, expect, it } from "vitest";

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
        beat: "orra-asks-about-the-signal",
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
});

import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "../verticalSliceState";
import "./bootWindowGame";

describe("Aftersign NPC memory round-trip harness contract", () => {
  it("requires a returning NPC to reference the saved player name and prior interaction count", () => {
    const game = window.__game as
      | (typeof window.__game & {
          setPlayerMemory?: (memory: {
            playerName: string;
            interactionCount: number;
          }) => void;
        })
      | undefined;

    expect(game).toBeDefined();
    expect(game?.setPlayerMemory).toEqual(expect.any(Function));

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        34,
      ),
    );
    game?.setPlayerMemory?.({ playerName: "Signal Runner", interactionCount: 3 });

    const savedPayload = game!.save();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.load(savedPayload);
    game?.meetNpc("io");

    const snapshot = game?.getStoryState() as
      | {
          story?: {
            npcMemoryRoundTrip?: {
              npcId?: string;
              playerName?: string;
              interactionCount?: number;
              spokenLine?: string;
            };
          };
        }
      | undefined;

    expect(snapshot?.story?.npcMemoryRoundTrip).toMatchObject({
      npcId: "io",
      playerName: "Signal Runner",
      interactionCount: 3,
    });
    expect(snapshot?.story?.npcMemoryRoundTrip?.spokenLine).toEqual(
      expect.stringContaining("Signal Runner"),
    );
    expect(snapshot?.story?.npcMemoryRoundTrip?.spokenLine).toEqual(
      expect.stringContaining("3"),
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

type StoredAftersignSave = {
  playerId: string;
  payload: string;
};

class SimulatedAftersignDurableSaveObject {
  private readonly storage: Map<string, StoredAftersignSave>;

  constructor(storage = new Map<string, StoredAftersignSave>()) {
    this.storage = storage;
  }

  savePlayerMemory(playerId: string, payload: string) {
    this.storage.set(playerId, { playerId, payload });
  }

  loadPlayerMemory(playerId: string) {
    return this.storage.get(playerId)?.payload ?? null;
  }

  simulateSessionRestart() {
    return new SimulatedAftersignDurableSaveObject(this.storage);
  }
}

describe("Aftersign durable save restart contract", () => {
  it("survives a simulated Durable Object restart before the returning recognition beat", () => {
    const playerId = "player-persistent-7";
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const durableObject = new SimulatedAftersignDurableSaveObject();

    durableObject.savePlayerMemory(playerId, encodeAftersignDurableSave(firstSession, 17));

    const restartedDurableObject = durableObject.simulateSessionRestart();
    const restoredPayload = restartedDurableObject.loadPlayerMemory(playerId);

    expect(restoredPayload).not.toBeNull();

    const returningSession = meetIoForAftersignSlice(
      restoreAftersignDurableSave(restoredPayload ?? ""),
    );
    const snapshot = getAftersignStoryState(returningSession, {
      playerId,
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-before-restart"],
    });

    expect(snapshot).toMatchObject({
      story: {
        beat: "io-remembers-opened-packet",
      },
      state: {
        save: {
          key: "aftersign.verticalSlice.v1",
          savedAtTurn: 17,
        },
        npcs: [
          {
            id: "io",
            disposition: "recognizes-player",
            rememberedSessionIds: ["session-before-restart"],
            memory: {
              recognizesPlayer: true,
              packetOutcome: "opened",
            },
          },
        ],
      },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

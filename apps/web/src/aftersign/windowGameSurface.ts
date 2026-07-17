import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";

import type {
  AftersignPacketOutcome,
  AftersignVerticalSliceState,
} from "./verticalSliceState";

export type AftersignWindowGame = {
  readonly state: AftersignVerticalSliceState;
  choosePacket: (packetOutcome: AftersignPacketOutcome) => void;
  meetIo: () => void;
};

export type AftersignWindowGameHost = {
  __game?: AftersignWindowGame;
};

export function createAftersignWindowGame(): AftersignWindowGame {
  let state = createAftersignVerticalSliceState();

  return {
    get state() {
      return state;
    },
    choosePacket(packetOutcome) {
      state = recordAftersignPacketChoice(state, packetOutcome);
    },
    meetIo() {
      state = meetIoForAftersignSlice(state);
    },
  };
}

export function installAftersignWindowGame(
  host: AftersignWindowGameHost,
): AftersignWindowGame {
  const game = createAftersignWindowGame();
  host.__game = game;
  return game;
}

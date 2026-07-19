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

export type AftersignGameSurfaceMode = "test" | "play";

export type AftersignGameSurfaceOptions = {
  mode: AftersignGameSurfaceMode;
  playerId: string;
  now: () => number;
};

export type AftersignGameSurfaceSnapshot = {
  story: {
    act: "vertical-slice";
    beatId: "arrival-at-io-phone";
    status: "active" | "stopped";
    startedAt: number | null;
  };
  player: {
    id: string;
    canMove: boolean;
  };
  npcs: Array<{
    id: "io";
    present: boolean;
    currentBeatId: "arrival-at-io-phone";
  }>;
};

export type AftersignGameSurface = {
  start: () => void;
  stop: () => void;
  getSnapshot: () => AftersignGameSurfaceSnapshot;
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

export function createAftersignGameSurface(
  options: AftersignGameSurfaceOptions,
): AftersignGameSurface {
  let startedAt: number | null = null;
  let isRunning = false;

  return {
    start() {
      startedAt = options.now();
      isRunning = true;
    },
    stop() {
      isRunning = false;
    },
    getSnapshot() {
      return {
        story: {
          act: "vertical-slice",
          beatId: "arrival-at-io-phone",
          status: isRunning ? "active" : "stopped",
          startedAt,
        },
        player: {
          id: options.playerId,
          canMove: isRunning,
        },
        npcs: [
          {
            id: "io",
            present: isRunning,
            currentBeatId: "arrival-at-io-phone",
          },
        ],
      };
    },
  };
}

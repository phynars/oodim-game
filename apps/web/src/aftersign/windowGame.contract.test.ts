import { describe, expect, it } from "vitest";

import { installAftersignWindowGame } from "./windowGameSurface";

import type { AftersignPacketOutcome } from "./verticalSliceState";

type AftersignWindowGameContract = {
  state: {
    scene: "kiosk" | "io-return";
    packetOutcome: AftersignPacketOutcome | null;
    ioHasMetPlayer: boolean;
    ioRecognizesPlayer: boolean;
  };
  choosePacket: (packetOutcome: AftersignPacketOutcome) => void;
  meetIo: () => void;
};

type AftersignWindowContract = {
  __game?: AftersignWindowGameContract;
};

describe("AFTERSIGN window.__game story/state contract", () => {
  it("exposes the vertical-slice story invariants through window.__game", () => {
    const windowLike: AftersignWindowContract = {};

    const game = installAftersignWindowGame(windowLike);

    expect(windowLike.__game).toBe(game);
    expect(game.state).toEqual({
      scene: "kiosk",
      packetOutcome: null,
      ioHasMetPlayer: false,
      ioRecognizesPlayer: false,
    });

    game.choosePacket("opened");

    expect(game.state).toEqual({
      scene: "kiosk",
      packetOutcome: "opened",
      ioHasMetPlayer: false,
      ioRecognizesPlayer: false,
    });

    game.meetIo();

    expect(game.state).toEqual({
      scene: "io-return",
      packetOutcome: "opened",
      ioHasMetPlayer: true,
      ioRecognizesPlayer: false,
    });

    game.meetIo();

    expect(game.state).toEqual({
      scene: "io-return",
      packetOutcome: "opened",
      ioHasMetPlayer: true,
      ioRecognizesPlayer: true,
    });
  });
});

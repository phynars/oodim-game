import { describe, expect, it } from "vitest";

import type { FlagshipGameSurface } from "../../../../e2e-shared/flagshipStoryStateContract";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

type ClaimedFlagshipSubset = {
  scene: Pick<FlagshipGameSurface["scene"], "id" | "act" | "beat">;
  delivery: Pick<FlagshipGameSurface["delivery"], "id" | "outcome">;
  npcs: {
    io: Pick<FlagshipGameSurface["npcs"]["io"], "id">;
  };
};

describe("AftersignWindowGameSurface flagship alignment", () => {
  it("pins the FlagshipGameSurface subset the vertical-slice snapshot claims today", () => {
    const surface = createAftersignWindowGameSurface(
      state({
        scene: "io-night-post-kiosk",
        packetOutcome: "sealed",
        ioHasMetPlayer: true,
        ioRecognizesPlayer: true,
      }),
      {
        playerId: "player-flagship-alignment",
        playerName: "Trace",
        rememberedSessionIds: ["session-before"],
      },
    );

    const snapshot = surface.getStoryState();
    const aligned = toClaimedFlagshipSubset(snapshot);

    expect(aligned).toEqual({
      scene: {
        id: "io-night-post-kiosk",
        act: "act-1-seal",
        beat: "io-return-recognition",
      },
      delivery: {
        id: "blue-packet",
        outcome: "sealed",
      },
      npcs: {
        io: {
          id: "io",
        },
      },
    } satisfies ClaimedFlagshipSubset);
  });
});

function toClaimedFlagshipSubset(
  snapshot: AftersignStoryStateSnapshot,
): ClaimedFlagshipSubset {
  return {
    scene: {
      id: mapSceneId(snapshot.state.scene),
      act: "act-1-seal",
      beat: mapStoryBeat(snapshot.story.beat),
    },
    delivery: {
      id: "blue-packet",
      outcome: snapshot.state.npcs[0].memory.packetOutcome ?? "unknown",
    },
    npcs: {
      io: {
        id: snapshot.state.npcs[0].id,
      },
    },
  };
}

function mapSceneId(
  scene: AftersignStoryStateSnapshot["state"]["scene"],
): FlagshipGameSurface["scene"]["id"] {
  if (scene !== "io-night-post-kiosk") {
    throw new Error(`No FlagshipGameSurface scene mapping for '${scene}'.`);
  }
  return "io-night-post-kiosk";
}

function mapStoryBeat(
  beat: AftersignStoryStateSnapshot["story"]["beat"],
): FlagshipGameSurface["scene"]["beat"] {
  switch (beat) {
    case "packet-unresolved":
      return "arrival";
    case "packet-sealed":
    case "packet-opened":
      return "packet-choice";
    case "io-first-meeting":
      return "packet-offered";
    case "io-remembers-sealed-packet":
    case "io-remembers-opened-packet":
      return "io-return-recognition";
  }
}

function state(
  overrides: Partial<AftersignVerticalSliceState>,
): AftersignVerticalSliceState {
  return {
    scene: "io-night-post-kiosk",
    packetOutcome: null,
    ioHasMetPlayer: false,
    ioRecognizesPlayer: false,
    ...overrides,
  } as AftersignVerticalSliceState;
}

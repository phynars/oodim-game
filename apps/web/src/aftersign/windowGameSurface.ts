import {
  type AftersignPacketOutcome,
  type AftersignSceneId,
  type AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

export type AftersignStoryBeatId =
  | "packet-unresolved"
  | "packet-sealed"
  | "packet-opened"
  | "io-first-meeting"
  | "io-remembers-sealed-packet"
  | "io-remembers-opened-packet";

export type AftersignStoryStateSnapshot = {
  story: {
    id: "aftersign.verticalSlice";
    act: "act-1";
    beat: AftersignStoryBeatId;
    completedBeats: AftersignStoryBeatId[];
  };
  state: {
    scene: AftersignSceneId;
    player: {
      id: string;
      name: string;
    };
    npcs: [
      {
        id: "io";
        name: "Io";
        disposition: "waiting" | "met-player" | "recognizes-player";
        rememberedSessionIds: string[];
        memory: {
          recognizesPlayer: boolean;
          packetOutcome: AftersignPacketOutcome | null;
        };
      },
    ];
  };
};

export type AftersignStoryStateOptions = {
  playerId: string;
  playerName: string;
  rememberedSessionIds?: string[];
};

export type AftersignWindowGameSurface = {
  getStoryState(): AftersignStoryStateSnapshot;
};

export function createAftersignWindowGameSurface(
  state: AftersignVerticalSliceState,
  options: AftersignStoryStateOptions,
): AftersignWindowGameSurface {
  return {
    getStoryState: () => getAftersignStoryState(state, options),
  };
}

export function getAftersignStoryState(
  state: AftersignVerticalSliceState,
  options: AftersignStoryStateOptions,
): AftersignStoryStateSnapshot {
  return {
    story: {
      id: "aftersign.verticalSlice",
      act: "act-1",
      beat: getAftersignCurrentStoryBeat(state),
      completedBeats: getAftersignCompletedStoryBeats(state),
    },
    state: {
      scene: state.scene,
      player: {
        id: options.playerId,
        name: options.playerName,
      },
      npcs: [
        {
          id: "io",
          name: "Io",
          disposition: getAftersignIoDisposition(state),
          rememberedSessionIds: [...(options.rememberedSessionIds ?? [])],
          memory: {
            recognizesPlayer: state.ioRecognizesPlayer,
            packetOutcome: state.packetOutcome,
          },
        },
      ],
    },
  };
}

function getAftersignCurrentStoryBeat(
  state: AftersignVerticalSliceState,
): AftersignStoryBeatId {
  if (state.ioRecognizesPlayer && state.packetOutcome === "opened") {
    return "io-remembers-opened-packet";
  }
  if (state.ioRecognizesPlayer && state.packetOutcome === "sealed") {
    return "io-remembers-sealed-packet";
  }
  if (state.ioHasMetPlayer) {
    return "io-first-meeting";
  }
  if (state.packetOutcome === "opened") {
    return "packet-opened";
  }
  if (state.packetOutcome === "sealed") {
    return "packet-sealed";
  }
  return "packet-unresolved";
}

function getAftersignCompletedStoryBeats(
  state: AftersignVerticalSliceState,
): AftersignStoryBeatId[] {
  const completedBeats: AftersignStoryBeatId[] = [];

  if (state.packetOutcome === "opened") {
    completedBeats.push("packet-opened");
  } else if (state.packetOutcome === "sealed") {
    completedBeats.push("packet-sealed");
  }

  if (state.ioHasMetPlayer) {
    completedBeats.push("io-first-meeting");
  }

  if (state.ioRecognizesPlayer && state.packetOutcome === "opened") {
    completedBeats.push("io-remembers-opened-packet");
  } else if (state.ioRecognizesPlayer && state.packetOutcome === "sealed") {
    completedBeats.push("io-remembers-sealed-packet");
  }

  return completedBeats;
}

function getAftersignIoDisposition(
  state: AftersignVerticalSliceState,
): AftersignStoryStateSnapshot["state"]["npcs"][number]["disposition"] {
  if (state.ioRecognizesPlayer) {
    return "recognizes-player";
  }
  if (state.ioHasMetPlayer) {
    return "met-player";
  }
  return "waiting";
}

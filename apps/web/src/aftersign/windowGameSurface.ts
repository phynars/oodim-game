import {
  sampleAftersignIoMemoryBeat,
  sampleAftersignOrraMemoryBeat,
  type AftersignIoMemoryBeat,
  type AftersignOrraMemoryBeat,
} from "./verticalSliceRecognitionBeat";
import {
  type AftersignOrraAction,
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
  | "io-remembers-opened-packet"
  | "orra-first-meeting"
  | "orra-remembers-answered-saint-orra";

export type AftersignStoryStateSnapshot = {
  story: {
    id: "aftersign.verticalSlice";
    act: "act-1";
    beat: AftersignStoryBeatId;
    completedBeats: AftersignStoryBeatId[];
    ioMemoryBeat?: AftersignIoMemoryBeat;
    orraMemoryBeat?: AftersignOrraMemoryBeat;
  };
  state: {
    scene: AftersignSceneId;
    player: {
      id: string;
      name: string;
    };
    npcs: Array<
      | {
          id: "io";
          name: "Io";
          disposition: "waiting" | "met-player" | "recognizes-player";
          rememberedSessionIds: string[];
          memory: {
            recognizesPlayer: boolean;
            packetOutcome: AftersignPacketOutcome | null;
          };
        }
      | {
          id: "orra";
          name: "Saint Orra";
          disposition: "waiting" | "met-player" | "recognizes-player";
          rememberedSessionIds: string[];
          memory: {
            recognizesPlayer: boolean;
            orraAction: AftersignOrraAction | null;
          };
        }
    >;
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
  const story: AftersignStoryStateSnapshot["story"] = {
    id: "aftersign.verticalSlice",
    act: "act-1",
    beat: getAftersignCurrentStoryBeat(state),
    completedBeats: getAftersignCompletedStoryBeats(state),
  };
  const rememberedSessionIds = [...(options.rememberedSessionIds ?? [])];

  if (state.ioHasMetPlayer || state.ioRecognizesPlayer) {
    story.ioMemoryBeat = sampleAftersignIoMemoryBeat(state);
  }
  if (state.orraHasMetPlayer || state.orraRecognizesPlayer || state.orraAction) {
    story.orraMemoryBeat = sampleAftersignOrraMemoryBeat(state);
  }

  return {
    story,
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
          rememberedSessionIds,
          memory: {
            recognizesPlayer: state.ioRecognizesPlayer,
            packetOutcome: state.packetOutcome,
          },
        },
        ...(state.orraHasMetPlayer || state.orraRecognizesPlayer || state.orraAction
          ? [
              {
                id: "orra" as const,
                name: "Saint Orra" as const,
                disposition: getAftersignOrraDisposition(state),
                rememberedSessionIds,
                memory: {
                  recognizesPlayer: state.orraRecognizesPlayer,
                  orraAction: state.orraAction,
                },
              },
            ]
          : []),
      ],
    },
  };
}

function getAftersignCurrentStoryBeat(
  state: AftersignVerticalSliceState,
): AftersignStoryBeatId {
  if (state.orraRecognizesPlayer && state.orraAction === "answered-saint-orra") {
    return "orra-remembers-answered-saint-orra";
  }
  if (state.ioRecognizesPlayer && state.packetOutcome === "opened") {
    return "io-remembers-opened-packet";
  }
  if (state.ioRecognizesPlayer && state.packetOutcome === "sealed") {
    return "io-remembers-sealed-packet";
  }
  if (state.orraHasMetPlayer) {
    return "orra-first-meeting";
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
  if (state.orraHasMetPlayer) {
    completedBeats.push("orra-first-meeting");
  }

  if (state.ioRecognizesPlayer && state.packetOutcome === "opened") {
    completedBeats.push("io-remembers-opened-packet");
  } else if (state.ioRecognizesPlayer && state.packetOutcome === "sealed") {
    completedBeats.push("io-remembers-sealed-packet");
  }
  if (state.orraRecognizesPlayer && state.orraAction === "answered-saint-orra") {
    completedBeats.push("orra-remembers-answered-saint-orra");
  }

  return completedBeats;
}

function getAftersignIoDisposition(
  state: AftersignVerticalSliceState,
): "waiting" | "met-player" | "recognizes-player" {
  if (state.ioRecognizesPlayer) {
    return "recognizes-player";
  }
  if (state.ioHasMetPlayer) {
    return "met-player";
  }
  return "waiting";
}

function getAftersignOrraDisposition(
  state: AftersignVerticalSliceState,
): "waiting" | "met-player" | "recognizes-player" {
  if (state.orraRecognizesPlayer) {
    return "recognizes-player";
  }
  if (state.orraHasMetPlayer) {
    return "met-player";
  }
  return "waiting";
}

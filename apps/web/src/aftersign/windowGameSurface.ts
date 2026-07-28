import {
  AFTERSIGN_IO_FIRST_SCENE_DIALOGUE,
  composeAftersignIoReturnBeat,
  getAftersignIoFirstSceneLine,
  type AftersignIoFirstSceneLine,
} from "./ioFirstSceneDialogue";
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

export type AftersignIoDialogueSnapshot = {
  /**
   * Kiosk beat lines Io speaks BEFORE the player commits the packet
   * fork. Emitted while `state.scene === "kiosk"` — arrival, route,
   * packetOffer. Sourced from `AFTERSIGN_IO_FIRST_SCENE_DIALOGUE` so
   * the scene renderer and the durable-save layer see the same words.
   */
  readonly kioskLines: readonly AftersignIoFirstSceneLine[];
  /**
   * Return-beat pair (packet + route memory) Io speaks when the player
   * comes back — emitted only when the player has committed a packet
   * outcome (i.e. `composeAftersignIoReturnBeat` will not throw).
   */
  readonly returnBeat?: {
    readonly packetLine: AftersignIoFirstSceneLine;
    readonly routeLine: AftersignIoFirstSceneLine;
  };
};

export type AftersignStoryStateSnapshot = {
  story: {
    id: "aftersign.verticalSlice";
    act: "act-1";
    beat: AftersignStoryBeatId;
    completedBeats: AftersignStoryBeatId[];
    ioMemoryBeat?: AftersignIoMemoryBeat;
    orraMemoryBeat?: AftersignOrraMemoryBeat;
    ioDialogue: AftersignIoDialogueSnapshot;
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
  /**
   * Whether the player heard Io's kiosk route beat before running the
   * route. Drives which of the two route-memory return lines
   * (`listened_to_route` / `skipped_route`) Io speaks on return.
   * Defaults to `false` (skipped) so callers that don't yet track this
   * still get a valid snapshot.
   */
  listenedToRoute?: boolean;
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
    ioDialogue: getAftersignIoDialogueSnapshot(state, {
      listenedToRoute: options.listenedToRoute ?? false,
    }),
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

/**
 * Assemble Io's spoken dialogue for the runtime surface.
 *
 * This is the seam that makes `ioFirstSceneDialogue` non-test code:
 *   - Kiosk lines (arrival / route / packetOffer) are always emitted so
 *     the scene renderer can play the fork setup at scene "kiosk".
 *   - The return beat (packet-memory + route-memory pair) is emitted
 *     only when the player has committed a packet outcome — i.e. the
 *     scene has advanced past the fork. That gate matches
 *     `composeAftersignIoReturnBeat`'s throw-on-uncommitted contract.
 */
function getAftersignIoDialogueSnapshot(
  state: AftersignVerticalSliceState,
  options: { listenedToRoute: boolean },
): AftersignIoDialogueSnapshot {
  const kioskLines: readonly AftersignIoFirstSceneLine[] = [
    getAftersignIoFirstSceneLine("arrival"),
    getAftersignIoFirstSceneLine("route"),
    getAftersignIoFirstSceneLine("packetOffer"),
  ] satisfies readonly AftersignIoFirstSceneLine[];

  // Reference the module-level dialogue constant so a scene renderer
  // that wants the full ordered list (not just the kiosk three) can
  // rely on the same source of truth. Fixing an off-by-one on this
  // guard means the invariant lives here, not in a caller.
  if (kioskLines.length > AFTERSIGN_IO_FIRST_SCENE_DIALOGUE.length) {
    throw new Error(
      "Aftersign Io kiosk line count exceeds the dialogue module — regenerate the snapshot.",
    );
  }

  if (state.packetOutcome === "sealed" || state.packetOutcome === "opened") {
    return {
      kioskLines,
      returnBeat: composeAftersignIoReturnBeat(state, {
        listenedToRoute: options.listenedToRoute,
      }),
    };
  }

  return { kioskLines };
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

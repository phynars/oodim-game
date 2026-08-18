import {
  AFTERSIGN_IO_FIRST_SCENE_DIALOGUE,
  composeAftersignIoReturnBeat,
  getAftersignIoFirstSceneLine,
  type AftersignIoFirstSceneLine,
} from "./ioFirstSceneDialogue";
import {
  buildIoMemorySentence,
  buildIoReturnMemoryThread,
  ioPacketReturnLine,
  type AftersignReturnReason,
} from "./ioVoiceContract";
import {
  sampleAftersignIoMemoryBeat,
  sampleAftersignOrraMemoryBeat,
  type AftersignIoMemoryBeat,
  type AftersignOrraMemoryBeat,
} from "./verticalSliceRecognitionBeat";
import {
  resolveAftersignRememberingNpcDialogue,
  type AftersignOrraAction,
  type AftersignPacketOutcome,
  type AftersignRememberingNpcRecognitionFeel,
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
  | "orra-remembers-answered-saint-orra"
  | "return-tone-choice"
  | "io-next-job";

export type AftersignIoDialogueSnapshot = {
  /**
   * The line the runtime should put in front of the player now. Fresh
   * kiosk states start on arrival; committed packet states surface the
   * packet-memory return line first.
   */
  readonly activeLine: AftersignIoFirstSceneLine;
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
  /**
   * Auditable memory sentences Io "remembers" about the player's prior
   * run, built from the canonical voice contract in `ioVoiceContract.ts`.
   * Present iff the packet fork has been committed AND a return posture
   * is known — same gate as `returnBeat`, plus a `returnReason`.
   *
   * Two shapes:
   *   • `packetReturn` — the one-line memory Io names as soon as the
   *     player is back, keyed off `packetOutcome`. Emitted whenever the
   *     fork is committed, regardless of whether a `returnReason` is
   *     known. This is what makes `ioPacketReturnLine` a live consumer.
   *   • `thread` — the full ordered three-line memory (route + packet
   *     + return-reason) built by `buildIoReturnMemoryThread`. Requires
   *     `returnReason` to be supplied by the caller.
   *
   * Persisted as plain strings so a `window.__game` consumer can render
   * them without importing the contract module.
   */
  readonly memoryThread?: {
    readonly packetReturn: string;
    readonly thread?: readonly string[];
  };
};

export type AftersignSaveSnapshot = {
  key: "aftersign.verticalSlice.v1";
  savedAtTurn: number;
};

/**
 * Round-trip beat: what a returning NPC speaks when their recognition
 * of the player references the two axes the surface carries about
 * the player (name + prior-interaction count). Emitted whenever a
 * caller supplies `options.npcMemoryRoundTrip` AND the referenced
 * NPC's disposition on the current state is `recognizes-player` —
 * otherwise absent, so consumers that don't opt in see the same
 * shape they always did.
 *
 * Renamed from `AftersignNpcMemoryRoundTripSnapshot` to avoid a
 * package-level type-name collision with the different-shape
 * `AftersignNpcMemoryRoundTripSnapshot` exported by
 * `./npcMemoryRoundTrip.ts` (the beat-store contract).
 *
 * `spokenLine` is sourced verbatim from
 * `resolveAftersignRememberingNpcDialogue`'s first line — authored
 * copy from the `AFTERSIGN_IO_RETURNING_SESSION_LINES` / Orra table.
 * Not interpolated with `playerName` or `interactionCount`: the
 * shape's job is to carry the authored voice alongside the two axes
 * a renderer can compose without mutating the line.
 */
export type AftersignSpokenNpcMemoryRoundTrip = {
  npcId: "io" | "orra";
  playerName: string;
  interactionCount: number;
  spokenLine: string;
  /**
   * Feel envelope the surface should play alongside the spoken line —
   * pre-line hold, portrait push-in, recognition-ring flash, subtitle
   * pop, audio-cue delay. Sourced from
   * `AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL` via
   * `resolveAftersignRememberingNpcDialogue` so the beat carries the
   * feel timing on the same shape as the copy — a renderer never has
   * to import the constant separately from the line it decorates.
   *
   * Present iff `dialogue.recognitionFeel` is non-null, which the
   * resolver gates on `recognizesPlayer`. `buildNpcMemoryRoundTripBeat`
   * already refuses to emit the beat unless recognition is true, so
   * `recognitionFeel` is always defined on an emitted round-trip.
   */
  recognitionFeel: AftersignRememberingNpcRecognitionFeel;
};

/**
 * Input the surface accepts to publish `story.npcMemoryRoundTrip`.
 * Split from the output shape so callers pass only the two axes
 * they own — the surface fills in `spokenLine` from the shipped
 * dialogue table and derives `npcId` from what actually recognizes
 * the player on this state.
 */
export type AftersignNpcMemoryRoundTripInput = {
  npcId: "io" | "orra";
  playerName: string;
  interactionCount: number;
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
    npcMemoryRoundTrip?: AftersignSpokenNpcMemoryRoundTrip;
  };
  /**
   * Scene block with the current beat alongside the scene id, so a
   * harness can assert `snapshot.scene.beat` per the story-state
   * contract (`docs/flagship/story-state-contract.md`) without
   * reaching into `story.beat`. `scene.beat` and `story.beat` are
   * always the same value — one derivation, two read paths.
   */
  scene: {
    id: AftersignSceneId;
    beat: AftersignStoryBeatId;
  };
  state: {
    scene: AftersignSceneId;
    player: {
      id: string;
      name: string;
    };
    save?: AftersignSaveSnapshot;
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
  /**
   * Optional posture the player struck when Io asked why they came
   * back — the third axis on the return beat, per `ioVoiceContract.ts`.
   * When supplied, the surface emits a full three-line
   * `ioDialogue.memoryThread.thread` (route + packet + return-reason).
   * When omitted, only the single-line `packetReturn` memory is
   * emitted (and the fork must still be committed for either).
   */
  returnReason?: AftersignReturnReason;
  /**
   * Two-axis player memory the returning-session recognition beat
   * references. When supplied AND the referenced NPC currently
   * recognizes the player on this state, the surface publishes
   * `story.npcMemoryRoundTrip` with `spokenLine` sourced verbatim
   * from `resolveAftersignRememberingNpcDialogue`'s first line
   * (authored copy, not interpolated). Absent otherwise.
   *
   * This is the shipped consumer of the round-trip contract: any
   * caller of `createAftersignWindowGameSurface` that carries a
   * returning-player name + prior-interaction count into the
   * surface — not just the harness — gets the beat on the snapshot.
   */
  npcMemoryRoundTrip?: AftersignNpcMemoryRoundTripInput;
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
  const currentBeat = getAftersignCurrentStoryBeat(state);
  const story: AftersignStoryStateSnapshot["story"] = {
    id: "aftersign.verticalSlice",
    act: "act-1",
    beat: currentBeat,
    completedBeats: getAftersignCompletedStoryBeats(state),
    ioDialogue: getAftersignIoDialogueSnapshot(state, {
      listenedToRoute: options.listenedToRoute ?? false,
      returnReason: options.returnReason,
    }),
  };
  const rememberedSessionIds = [...(options.rememberedSessionIds ?? [])];
  const save = getAftersignSaveSnapshot(state);

  if (state.ioHasMetPlayer || state.ioRecognizesPlayer) {
    story.ioMemoryBeat = sampleAftersignIoMemoryBeat(state);
  }
  if (state.orraHasMetPlayer || state.orraRecognizesPlayer || state.orraAction) {
    story.orraMemoryBeat = sampleAftersignOrraMemoryBeat(state);
  }

  // Publish the round-trip beat when the caller supplied a memory
  // bag AND the referenced NPC actually recognizes the player on
  // this state. Copy comes verbatim from
  // `resolveAftersignRememberingNpcDialogue` (authored table) — no
  // interpolation of `playerName` / `interactionCount` into the
  // line. The two axes ride alongside so a renderer can compose,
  // but the story voice stays what a writer wrote.
  const roundTripBeat = buildNpcMemoryRoundTripBeat(state, options.npcMemoryRoundTrip);
  if (roundTripBeat) {
    story.npcMemoryRoundTrip = roundTripBeat;
  }

  return {
    story,
    scene: {
      id: state.scene,
      beat: currentBeat,
    },
    state: {
      scene: state.scene,
      player: {
        id: options.playerId,
        name: options.playerName,
      },
      ...(save ? { save } : {}),
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

function buildNpcMemoryRoundTripBeat(
  state: AftersignVerticalSliceState,
  memory: AftersignNpcMemoryRoundTripInput | undefined,
): AftersignSpokenNpcMemoryRoundTrip | undefined {
  if (!memory) {
    return undefined;
  }
  const recognizes =
    (memory.npcId === "io" && state.ioRecognizesPlayer) ||
    (memory.npcId === "orra" && state.orraRecognizesPlayer);
  if (!recognizes) {
    return undefined;
  }
  const dialogue = resolveAftersignRememberingNpcDialogue(state, memory.npcId);
  if (!dialogue.recognizesPlayer) {
    return undefined;
  }
  const spokenLine = dialogue.lines[0];
  if (typeof spokenLine !== "string" || spokenLine.length === 0) {
    return undefined;
  }
  // `dialogue.recognitionFeel` is gated on `recognizesPlayer` inside
  // the resolver — the branch above already guarantees recognition,
  // so this is non-null in practice. The explicit null-guard keeps
  // the surface honest against a future resolver refactor that
  // decouples the two axes: if the feel ever goes missing, we omit
  // the beat rather than shipping a spec-dressed shape (#1163 /
  // #1171-v1 pattern — populated but unused).
  if (dialogue.recognitionFeel === null) {
    return undefined;
  }
  return {
    npcId: memory.npcId,
    playerName: memory.playerName,
    interactionCount: memory.interactionCount,
    spokenLine,
    recognitionFeel: dialogue.recognitionFeel,
  };
}

function getAftersignSaveSnapshot(
  state: AftersignVerticalSliceState,
): AftersignSaveSnapshot | undefined {
  // `savedAtTurn` is set only by `restoreAftersignDurableSave`, which
  // attaches the envelope's turn to the state it returns. Fresh /
  // in-memory states leave it undefined, so the surface omits `save`.
  if (typeof state.savedAtTurn !== "number") {
    return undefined;
  }
  return {
    key: "aftersign.verticalSlice.v1",
    savedAtTurn: state.savedAtTurn,
  };
}

function getAftersignCurrentStoryBeat(
  state: AftersignVerticalSliceState,
): AftersignStoryBeatId {
  // M-CONTINUE-E1 (docs/plan/product-plan.md:194) beats sit at the
  // TOP of the selector because they represent the furthest-advanced
  // progression — the player has been recognized AND has chosen a
  // tone (`return-tone-choice`) or asked for the next job
  // (`io-next-job`, terminal). Both require `ioRecognizesPlayer`
  // because the return-tone fork hangs off the recognition beat.
  if (state.ioRecognizesPlayer && state.hasAskedForNextJob) {
    return "io-next-job";
  }
  if (state.ioRecognizesPlayer && state.hasChosenReturnTone) {
    return "return-tone-choice";
  }
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
  // M-CONTINUE-E1 tail — order matches the runtime progression
  // (`return-tone-choice` then `io-next-job`), both gated on Io
  // having recognized the returning player.
  if (state.ioRecognizesPlayer && state.hasChosenReturnTone) {
    completedBeats.push("return-tone-choice");
  }
  if (state.ioRecognizesPlayer && state.hasAskedForNextJob) {
    completedBeats.push("io-next-job");
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
 *   - The active line gives the served page one canonical sentence to
 *     render without re-deriving the story branch.
 *   - The return beat (packet-memory + route-memory pair) is emitted
 *     only when the player has committed a packet outcome — i.e. the
 *     scene has advanced past the fork. That gate matches
 *     `composeAftersignIoReturnBeat`'s throw-on-uncommitted contract.
 */
function getAftersignIoDialogueSnapshot(
  state: AftersignVerticalSliceState,
  options: { listenedToRoute: boolean; returnReason?: AftersignReturnReason },
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
    const returnBeat = composeAftersignIoReturnBeat(state, {
      listenedToRoute: options.listenedToRoute,
    });

    // Live wiring for the canonical voice contract. `ioPacketReturnLine`
    // is what makes `ioVoiceContract.ts` a shipped surface, not just a
    // typed constant with a test — the memory sentence goes into the
    // window.__game snapshot every time the fork is committed.
    const packetMemory = buildIoMemorySentence(
      ioPacketReturnLine(state.packetOutcome),
    );

    // `buildIoReturnMemoryThread` composes route + packet + reason. It
    // requires all three, so we only emit `thread` when the caller has
    // supplied a `returnReason`. The single-line `packetReturn` above
    // is always safe because packetOutcome is committed on this branch.
    const thread = options.returnReason
      ? buildIoReturnMemoryThread({
          routeAttention: options.listenedToRoute ? "heard" : "skipped",
          packetOutcome: state.packetOutcome,
          returnReason: options.returnReason,
        })
      : undefined;

    return {
      activeLine: returnBeat.packetLine,
      kioskLines,
      returnBeat,
      memoryThread: thread
        ? { packetReturn: packetMemory, thread }
        : { packetReturn: packetMemory },
    };
  }

  // Not on the return branch. `memoryThread` is contractually gated
  // on a committed packet fork (see the field's doc + the branch
  // above), so an uncommitted state emits no memory shape — even if
  // the caller happened to supply a `returnReason`. Papering over
  // that with a reason-only "packetReturn" would mis-key the field
  // (packet slot holding a reason sentence) — precisely the drift
  // this surface exists to prevent. A `returnReason` without a
  // committed packet is caller error and stays inert here.
  return {
    activeLine: kioskLines[0],
    kioskLines,
  };
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

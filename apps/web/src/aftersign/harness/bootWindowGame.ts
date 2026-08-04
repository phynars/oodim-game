import {
  getMemoryRecallFeel,
  type MemoryRecallFeelFrame,
} from "../memoryRecallFeel";
import {
  createAftersignVerticalSliceState,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  restoreAftersignDurableSave,
  type AftersignStoryStateSnapshot,
  type AftersignVerticalSliceState,
} from "../verticalSliceState";

/**
 * Recall-beat trigger emitted by `meetNpc` when a *previously-met* NPC
 * transitions from `hasMet` → `recognizesPlayer` on this call. The
 * scene renderer feeds each animation frame's `elapsedMs` (millis since
 * `firedAtMs`) into `recallFeel()` to sample the envelope for that
 * frame — halo scale, caption lift, camera yaw, bloom, audio, haptic.
 *
 * `firedAtMs` is the timestamp captured at the moment of recognition
 * so the renderer's own clock (`performance.now()`, `Date.now()`, or a
 * fixed test clock) can compute `elapsedMs = now - firedAtMs` without
 * the harness owning a scheduler.
 */
export type AftersignRecallTrigger = {
  npcId: "io" | "orra";
  firedAtMs: number;
};

export type AftersignRecallFeelOptions = {
  /**
   * Milliseconds since the trigger fired. Callers typically compute
   * this as `now - trigger.firedAtMs`; the harness clamps <0 to the
   * dormant frame and >durationMs to the tail of the held phase.
   */
  elapsedMs: number;
  /**
   * When true, camera yaw / caption lift / halo scale are trimmed and
   * haptic is suppressed, per `MEMORY_RECALL_FEEL`'s reduced-motion
   * contract. Defaults to false.
   */
  reducedMotion?: boolean;
};

export type AftersignWindowGameHarness = {
  version: 1;
  restoreDurableSave: (payload: string) => void;
  meetNpc: (id: "io" | "orra") => void;
  getStoryState: () => AftersignStoryStateSnapshot;
  /**
   * The most recent recall trigger captured by `meetNpc`, or `null`
   * when no NPC has recognized the player yet this session. A fresh
   * meet without prior memory (first contact) does NOT fire a
   * trigger — recall is a *return*-beat feel.
   */
  getRecallTrigger: () => AftersignRecallTrigger | null;
  /**
   * Sample the memory-recall envelope for the active trigger at
   * `elapsedMs`. Returns `null` when no trigger is active (renderer
   * should skip the recall pass). Otherwise returns the same frame
   * shape `getMemoryRecallFeel` produces — captionOpacity, haloScale,
   * cameraYawDeg, bloomGain, audioGain, hapticMs, phase.
   */
  recallFeel: (options: AftersignRecallFeelOptions) => MemoryRecallFeelFrame | null;
};

declare global {
  interface Window {
    __game?: AftersignWindowGameHarness;
  }
}

const HARNESS_PLAYER = {
  playerId: "harness-player",
  playerName: "Harness Player",
  rememberedSessionIds: [] as string[],
};

const ensureWindow = (): Window => {
  const maybeWindow = (globalThis as { window?: Window }).window;
  if (maybeWindow) {
    return maybeWindow;
  }

  const createdWindow = {} as Window;
  (globalThis as { window: Window }).window = createdWindow;
  return createdWindow;
};

/**
 * Best-effort monotonic clock. `performance.now()` in browsers &
 * jsdom, `Date.now()` as a fallback. The harness only uses this to
 * timestamp recall triggers — callers pass their own `elapsedMs` to
 * `recallFeel`, so the choice of clock only affects the *baseline*
 * the renderer subtracts from.
 */
const nowMs = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === "function") {
    return perf.now();
  }
  return Date.now();
};

export const bootAftersignWindowGame = (): AftersignWindowGameHarness => {
  let state: AftersignVerticalSliceState = createAftersignVerticalSliceState();
  let recallTrigger: AftersignRecallTrigger | null = null;

  const applyMeet = (
    id: "io" | "orra",
    previous: AftersignVerticalSliceState,
  ): AftersignVerticalSliceState => {
    const next =
      id === "io" ? meetIoForAftersignSlice(previous) : meetOrraForAftersignSlice(previous);

    // Recognition fires on the SECOND meet — i.e. the transition
    // `!prev.recognizes && next.recognizes`. First contact skips the
    // recall envelope (nothing to remember yet). Clearing a prior
    // trigger on a first-contact meet keeps the harness honest: only
    // one recall beat is "live" at a time, and it's always the most
    // recent recognition transition.
    const wasRecognizing =
      id === "io" ? previous.ioRecognizesPlayer : previous.orraRecognizesPlayer;
    const isRecognizing = id === "io" ? next.ioRecognizesPlayer : next.orraRecognizesPlayer;

    if (!wasRecognizing && isRecognizing) {
      recallTrigger = { npcId: id, firedAtMs: nowMs() };
    }

    return next;
  };

  const api: AftersignWindowGameHarness = {
    version: 1,
    restoreDurableSave(payload) {
      state = restoreAftersignDurableSave(payload);
      // A durable-save restore is a load, not a meet — no recall
      // envelope fires until the player actually re-encounters the
      // NPC via `meetNpc`.
      recallTrigger = null;
    },
    meetNpc(id) {
      state = applyMeet(id, state);
    },
    getStoryState() {
      return getAftersignStoryState(state, HARNESS_PLAYER);
    },
    getRecallTrigger() {
      return recallTrigger;
    },
    recallFeel({ elapsedMs, reducedMotion }) {
      if (!recallTrigger) {
        return null;
      }
      return getMemoryRecallFeel({ elapsedMs, reducedMotion });
    },
  };

  ensureWindow().__game = api;
  return api;
};

bootAftersignWindowGame();

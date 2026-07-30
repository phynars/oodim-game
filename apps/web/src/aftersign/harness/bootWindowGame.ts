import {
  createAftersignVerticalSliceState,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  restoreAftersignDurableSave,
  type AftersignStoryStateSnapshot,
  type AftersignVerticalSliceState,
} from "../verticalSliceState";

export type AftersignWindowGameHarness = {
  version: 1;
  restoreDurableSave: (payload: string) => void;
  meetNpc: (id: "io" | "orra") => void;
  getStoryState: () => AftersignStoryStateSnapshot;
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

export const bootAftersignWindowGame = (): AftersignWindowGameHarness => {
  let state: AftersignVerticalSliceState = createAftersignVerticalSliceState();

  const api: AftersignWindowGameHarness = {
    version: 1,
    restoreDurableSave(payload) {
      state = restoreAftersignDurableSave(payload);
    },
    meetNpc(id) {
      state = id === "io" ? meetIoForAftersignSlice(state) : meetOrraForAftersignSlice(state);
    },
    getStoryState() {
      return getAftersignStoryState(state, HARNESS_PLAYER);
    },
  };

  ensureWindow().__game = api;
  return api;
};

bootAftersignWindowGame();

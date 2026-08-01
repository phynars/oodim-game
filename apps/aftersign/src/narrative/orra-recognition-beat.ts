export type OrraSignalMemory = "taken" | "left";
export type OrraPaceMemory = "waited" | "rushed";
export type OrraDebtMemory = "named" | "refused";

export interface OrraRecognitionState {
  hasMetOrra: boolean;
  signal?: OrraSignalMemory;
  pace?: OrraPaceMemory;
  debt?: OrraDebtMemory;
}

export interface OrraRecognitionBeat {
  id: string;
  text: string;
  rememberedFacts: string[];
}

const FIRST_MEETING_BEAT: OrraRecognitionBeat = {
  id: "orra-first-meeting",
  text: "You are new enough to look honest. That will pass.",
  rememberedFacts: [],
};

const SIGNAL_BEATS: Record<OrraSignalMemory, OrraRecognitionBeat> = {
  taken: {
    id: "orra-signal-taken",
    text:
      "You came back with my signal still warm in your pocket. Good. That means you know when a debt is alive.",
    rememberedFacts: ["orra.met", "orra.signal.taken"],
  },
  left: {
    id: "orra-signal-left",
    text:
      "You left my signal behind and came back anyway. Either brave, lost, or expensive. I can work with two of those.",
    rememberedFacts: ["orra.met", "orra.signal.left"],
  },
};

const PACE_BEATS: Record<OrraPaceMemory, OrraRecognitionBeat> = {
  waited: {
    id: "orra-waited",
    text:
      "You waited last time. Most couriers mistake motion for nerve. You did not.",
    rememberedFacts: ["orra.met", "orra.pace.waited"],
  },
  rushed: {
    id: "orra-rushed",
    text: "You ran before the room finished speaking. The room remembers. So do I.",
    rememberedFacts: ["orra.met", "orra.pace.rushed"],
  },
};

const DEBT_BEATS: Record<OrraDebtMemory, OrraRecognitionBeat> = {
  named: {
    id: "orra-debt-named",
    text:
      "You named what you owed. Careful habit. Names make debts easier to find in the dark.",
    rememberedFacts: ["orra.met", "orra.debt.named"],
  },
  refused: {
    id: "orra-debt-refused",
    text:
      "You said you owed nothing. I respect a clean lie. I also keep ledgers.",
    rememberedFacts: ["orra.met", "orra.debt.refused"],
  },
};

export const ORRA_RECOGNITION_BEATS = {
  firstMeeting: FIRST_MEETING_BEAT,
  signal: SIGNAL_BEATS,
  pace: PACE_BEATS,
  debt: DEBT_BEATS,
} as const;

export function selectOrraRecognitionBeat(
  state: OrraRecognitionState,
): OrraRecognitionBeat {
  if (!state.hasMetOrra) {
    return FIRST_MEETING_BEAT;
  }

  if (state.debt) {
    return DEBT_BEATS[state.debt];
  }

  if (state.pace) {
    return PACE_BEATS[state.pace];
  }

  if (state.signal) {
    return SIGNAL_BEATS[state.signal];
  }

  return FIRST_MEETING_BEAT;
}

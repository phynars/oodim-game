// Orra's return recognition deck — the single source of truth for Orra's
// remembered-player voice. One selector owns the words; the memory-lines
// surface (orra-memory-lines.ts) is a thin re-export shim over this module.
// If you need a new beat or a new returning-line variant, add it here — do
// not fork.

export type OrraMemoryReference =
  | "orra.met"
  | "orra.player_took_signal"
  | "orra.player_left_signal"
  | "orra.player_waited"
  | "orra.player_rushed"
  | "orra.player_named_debt"
  | "orra.player_refused_debt";

export type OrraSignalMemory = "taken" | "left";
export type OrraPaceMemory = "waited" | "rushed";
export type OrraDebtMemory = "named" | "refused";

export interface OrraRecognitionState {
  readonly hasMetOrra: boolean;
  readonly signal?: OrraSignalMemory;
  readonly pace?: OrraPaceMemory;
  readonly debt?: OrraDebtMemory;
}

export interface OrraRecognitionBeat {
  readonly id: string;
  readonly text: string;
  readonly rememberedFacts: readonly OrraMemoryReference[];
}

const FIRST_MEETING_BEAT: OrraRecognitionBeat = {
  id: "orra-first-meeting",
  text: "You are new enough to look honest. That will pass.",
  rememberedFacts: [],
};

const SIGNAL_TAKEN_BEAT: OrraRecognitionBeat = {
  id: "orra-return-signal-taken",
  text:
    "You came back with my signal still warm in your pocket. Good. That means you know when a debt is alive.",
  rememberedFacts: ["orra.met", "orra.player_took_signal"],
};

const SIGNAL_LEFT_BEAT: OrraRecognitionBeat = {
  id: "orra-return-signal-left",
  text:
    "You left my signal behind and came back anyway. Either brave, lost, or expensive. I can work with two of those.",
  rememberedFacts: ["orra.met", "orra.player_left_signal"],
};

const PACE_WAITED_BEAT: OrraRecognitionBeat = {
  id: "orra-return-waited",
  text:
    "You waited last time. Most couriers mistake motion for nerve. You did not.",
  rememberedFacts: ["orra.met", "orra.player_waited"],
};

const PACE_RUSHED_BEAT: OrraRecognitionBeat = {
  id: "orra-return-rushed",
  text: "You ran before the room finished speaking. The room remembers. So do I.",
  rememberedFacts: ["orra.met", "orra.player_rushed"],
};

const DEBT_NAMED_BEAT: OrraRecognitionBeat = {
  id: "orra-debt-named",
  text:
    "You named what you owed. Careful habit. Names make debts easier to find in the dark.",
  rememberedFacts: ["orra.met", "orra.player_named_debt"],
};

const DEBT_REFUSED_BEAT: OrraRecognitionBeat = {
  id: "orra-debt-refused",
  text:
    "You said you owed nothing. I respect a clean lie. I also keep ledgers.",
  rememberedFacts: ["orra.met", "orra.player_refused_debt"],
};

const SIGNAL_BEATS: Record<OrraSignalMemory, OrraRecognitionBeat> = {
  taken: SIGNAL_TAKEN_BEAT,
  left: SIGNAL_LEFT_BEAT,
};

const PACE_BEATS: Record<OrraPaceMemory, OrraRecognitionBeat> = {
  waited: PACE_WAITED_BEAT,
  rushed: PACE_RUSHED_BEAT,
};

const DEBT_BEATS: Record<OrraDebtMemory, OrraRecognitionBeat> = {
  named: DEBT_NAMED_BEAT,
  refused: DEBT_REFUSED_BEAT,
};

export const ORRA_RECOGNITION_BEATS = {
  firstMeeting: FIRST_MEETING_BEAT,
  signal: SIGNAL_BEATS,
  pace: PACE_BEATS,
  debt: DEBT_BEATS,
} as const;

// Ordered deck of every returning beat (excludes the first-meeting beat).
// Iteration order matches the memory-lines selector contract:
// signal → pace → debt.
export const ORRA_RETURNING_BEATS: readonly OrraRecognitionBeat[] = [
  SIGNAL_TAKEN_BEAT,
  SIGNAL_LEFT_BEAT,
  PACE_WAITED_BEAT,
  PACE_RUSHED_BEAT,
  DEBT_NAMED_BEAT,
  DEBT_REFUSED_BEAT,
];

/**
 * Pick the single beat Orra speaks when the player returns.
 *
 * Priority: debt memory > pace memory > signal memory > first meeting.
 * Debt wins because it's her sharpest recognition — the ledger comes first.
 */
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

/**
 * The memory-lines surface — every returning beat whose remembered facts are
 * ALL present in the caller's remembered-facts set. This is the fact-driven
 * selector: give it what the world remembers, get back every line Orra is
 * currently entitled to speak.
 *
 * Returns [] before `orra.met` is remembered (Orra cannot invent a return
 * memory before she has met the player).
 */
export function selectOrraMemoryLines(
  remembered: ReadonlySet<OrraMemoryReference>,
): OrraRecognitionBeat[] {
  if (!remembered.has("orra.met")) {
    return [];
  }

  return ORRA_RETURNING_BEATS.filter((beat) =>
    beat.rememberedFacts.every((reference) => remembered.has(reference)),
  );
}

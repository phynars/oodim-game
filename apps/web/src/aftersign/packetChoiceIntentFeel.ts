// AFTERSIGN — packet choice intentionality feel contract.
//
// The first flagship choice cannot feel like menu trivia or a stray tap.
// Keeping the blue packet sealed is a quick confirm; opening it requires a
// short deliberate hold. This module is pure so the runtime and harness can
// share the exact same thresholds.

export type PacketChoiceKind = 'preserve-seal' | 'open-seal';
export type PacketChoiceInput = 'tap' | 'hold' | 'drag';

export interface PacketChoiceIntentSample {
  /** Duration from pointer/key down to release, in milliseconds. */
  readonly durationMs: number;
  /** Total pointer travel while the gesture was active, in CSS pixels. */
  readonly travelPx: number;
  /** Input family used by the player. */
  readonly input: PacketChoiceInput;
  /** Whether the packet affordance was visibly focused before release. */
  readonly affordanceFocused: boolean;
}

export interface PacketChoiceFeelVerdict {
  readonly accepted: boolean;
  readonly choice: PacketChoiceKind | null;
  readonly reason:
    | 'preserve-confirmed'
    | 'open-confirmed'
    | 'hold-too-short'
    | 'dragged-off-intent'
    | 'affordance-not-focused';
  /** Harness-facing scalar: 0 = accidental, 1 = unmistakably intentional. */
  readonly intentionality: number;
}

export const PACKET_CHOICE_FEEL = {
  preserveTapMinMs: 45,
  openHoldMinMs: 420,
  maxIntentTravelPx: 18,
  focusedIntentBonus: 0.2,
} as const;

export function judgePacketChoiceIntent(
  intendedChoice: PacketChoiceKind,
  sample: PacketChoiceIntentSample,
): PacketChoiceFeelVerdict {
  if (!sample.affordanceFocused) {
    return reject('affordance-not-focused', 0);
  }

  if (sample.travelPx > PACKET_CHOICE_FEEL.maxIntentTravelPx) {
    return reject('dragged-off-intent', clampIntent(1 - sample.travelPx / 48));
  }

  if (intendedChoice === 'preserve-seal') {
    const intentionality = clampIntent(
      sample.durationMs / PACKET_CHOICE_FEEL.preserveTapMinMs +
        PACKET_CHOICE_FEEL.focusedIntentBonus,
    );

    if (sample.durationMs < PACKET_CHOICE_FEEL.preserveTapMinMs) {
      return reject('hold-too-short', intentionality);
    }

    return accept('preserve-seal', 'preserve-confirmed', intentionality);
  }

  const intentionality = clampIntent(
    sample.durationMs / PACKET_CHOICE_FEEL.openHoldMinMs +
      PACKET_CHOICE_FEEL.focusedIntentBonus,
  );

  if (sample.durationMs < PACKET_CHOICE_FEEL.openHoldMinMs) {
    return reject('hold-too-short', intentionality);
  }

  return accept('open-seal', 'open-confirmed', intentionality);
}

export function packetChoiceProgress(sample: PacketChoiceIntentSample): number {
  if (!sample.affordanceFocused || sample.travelPx > PACKET_CHOICE_FEEL.maxIntentTravelPx) {
    return 0;
  }

  if (sample.input === 'hold') {
    return clampIntent(sample.durationMs / PACKET_CHOICE_FEEL.openHoldMinMs);
  }

  return clampIntent(sample.durationMs / PACKET_CHOICE_FEEL.preserveTapMinMs);
}

function accept(
  choice: PacketChoiceKind,
  reason: PacketChoiceFeelVerdict['reason'],
  intentionality: number,
): PacketChoiceFeelVerdict {
  return {
    accepted: true,
    choice,
    reason,
    intentionality: clampIntent(intentionality),
  };
}

function reject(
  reason: PacketChoiceFeelVerdict['reason'], intentionality: number): PacketChoiceFeelVerdict {
  return {
    accepted: false,
    choice: null,
    reason,
    intentionality: clampIntent(intentionality),
  };
}

function clampIntent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

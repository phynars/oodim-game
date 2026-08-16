// M-CONTINUE-E1 — Io continue beats (return-tone reply + next-job handoff).
//
// Pure data + selectors for the two beats that fire AFTER the player
// strikes a return posture (see `returnToneChoiceFeel.ts` /
// `ioVoiceContract.ts::AftersignReturnReason`):
//
//   1. RETURN_TONE_CHOICE — Io's reply LINE, one per posture. The
//      press-envelope feel is owned by `returnToneChoiceFeel.ts`;
//      this module owns the WORDS she says back.
//   2. NEXT_JOB_HANDOFF — the beat that hands the player off to
//      Saint Orra with the red-tag objective. Same tone regardless
//      of posture — the handoff is invariant, only the reply drifts.
//
// SHIPPED-SURFACE CONSUMER:
//   `harness/bootWindowGame.ts` imports `buildIoContinueBeats` and
//   exposes it on `window.__game` as `getIoContinueBeats()`. When the
//   player has struck a return posture via `setIoReturnReason(reason)`,
//   the served-page snapshot can read the two-beat sequence for that
//   posture; when no posture is recorded, the surface returns `null`.
//   Covered end-to-end by `ioContinueBeats.consumer.test.ts`.
//
// POSTURE TOKENS: `kind | evasive | blunt` — the SAME axis as
// `AftersignReturnReason`. Retyped as an alias so a caller passing
// the same string into the FEEL surface and into this VOICE surface
// can never hit a translation-layer bug.

import type { AftersignReturnReason } from "../ioVoiceContract";

export type IoContinueTone = AftersignReturnReason;

export const IO_CONTINUE_BEAT_IDS = Object.freeze({
  RETURN_TONE_CHOICE: "io-return-tone-choice",
  NEXT_JOB_HANDOFF: "io-next-job-handoff",
} as const);

export type IoContinueBeatId =
  (typeof IO_CONTINUE_BEAT_IDS)[keyof typeof IO_CONTINUE_BEAT_IDS];

export type IoReturnToneOption = {
  readonly id: IoContinueTone;
  readonly label: string;
  readonly reply: string;
};

export const IO_RETURN_TONE_OPTIONS: readonly IoReturnToneOption[] =
  Object.freeze([
    // #1234: replies are VERBATIM from the authored scene 8
    // (docs/flagship/vertical-slice-script.md §8, "Io if kind /
    // evasive / blunt"). The earlier paraphrases shipped the wiring
    // but not the words; the tap-driven e2e now pins each line.
    Object.freeze({
      id: "kind",
      label: "I came back because you trusted me.",
      reply:
        "Careful. Say that too often and people will start handing you breakable things.",
    }),
    Object.freeze({
      id: "evasive",
      label: "I had business nearby.",
      reply:
        "Work is a clean word. We can use it until it stains.",
    }),
    Object.freeze({
      id: "blunt",
      label: "You still owe me an explanation.",
      reply:
        "Good. Wanting is easier to route than pretending.",
    }),
  ]);

export type IoContinueReplyBeat = {
  readonly id: typeof IO_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE;
  readonly speaker: "Io";
  readonly tone: IoContinueTone;
  readonly line: string;
};

export type IoContinueHandoffBeat = {
  readonly id: typeof IO_CONTINUE_BEAT_IDS.NEXT_JOB_HANDOFF;
  readonly speaker: "Io";
  readonly line: string;
  readonly objective: string;
};

export const IO_NEXT_JOB_HANDOFF: IoContinueHandoffBeat = Object.freeze({
  id: IO_CONTINUE_BEAT_IDS.NEXT_JOB_HANDOFF,
  speaker: "Io",
  line:
    "Take the red tag to Saint Orra. If the pharmacy sign calls you by the wrong name, answer once and only once.",
  objective: "Carry Io\u2019s red tag to Saint Orra.",
});

export function getIoReturnToneReply(tone: IoContinueTone): string {
  const match = IO_RETURN_TONE_OPTIONS.find((option) => option.id === tone);
  // The `IoContinueTone` type constrains callers to the three valid
  // postures — the fallback exists only for hand-rolled JS callers
  // that bypass the type checker. Anchor to `evasive` (the middle
  // posture) so a stray token produces the mildest reply, not silence.
  return (match ?? IO_RETURN_TONE_OPTIONS[1]).reply;
}

export type IoContinueBeat = IoContinueReplyBeat | IoContinueHandoffBeat;

export function buildIoContinueBeats(
  tone: IoContinueTone,
): readonly [IoContinueReplyBeat, IoContinueHandoffBeat] {
  return [
    {
      id: IO_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE,
      speaker: "Io",
      tone,
      line: getIoReturnToneReply(tone),
    },
    IO_NEXT_JOB_HANDOFF,
  ];
}

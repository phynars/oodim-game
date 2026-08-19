// Io's "second packet" offer copy — the beat immediately after
// `io-next-job` (see aftersign/main.js "io-next-job" branch) where the
// player, having posted a return tone, is handed a second run.
//
// This module owns the WORDS only: three frozen return-tone variants
// (gentle / defiant / guarded), a graceful `playerName` fallback, and a
// deterministic choice pair. It is copy-only — no DOM, no state, no
// timing. That's deliberate: the render-site wire-in is a separate
// story (see follow-up #TODO cited below), and the copy has to be
// pinned before the beat can consume it.
//
// Consumer contract (why this module isn't orphaned):
//   1. `aftersign/src/ioSecondPacketCopy.test.ts` — pure-runner check
//      bundle asserting every tone renders three lines, the fallback
//      path drops the trailing address when `playerName` is empty /
//      not a string, and the whole return payload is deeply frozen so
//      a caller can't mutate the tone table by reference.
//   2. `aftersign/pure-runner.ts` — registers the check bundle in the
//      `test:aftersign:pure` lane, so CI reds on any drift.
//
// Follow-up (render wire-in) is tracked in issue #1322 — it will
// import `selectIoSecondPacketCopy` inside `main.js`'s `io-next-job`
// branch and stamp the lines through the existing `#line` /
// `#speaker` seam, with a tap-driven e2e that asserts the rendered
// strings verbatim against this module.

export const IO_SECOND_PACKET_COPY_ID = 'io-second-packet-offer';

export type IoSecondPacketReturnTone = 'gentle' | 'defiant' | 'guarded';

interface ReturnToneLineSet {
  readonly recognition: string;
  readonly offer: string;
  readonly prompt: string;
}

const RETURN_TONE_LINES: Readonly<Record<IoSecondPacketReturnTone, ReturnToneLineSet>> =
  Object.freeze({
    gentle: Object.freeze({
      recognition: 'You came back quiet. I can work with quiet.',
      offer: 'Second packet. Same hands. Less mercy in the route.',
      prompt: 'Take it if you mean to be remembered for something useful.',
    }),
    defiant: Object.freeze({
      recognition: 'Still standing like the door owes you an apology.',
      offer: 'Good. The second packet needs a spine more than it needs speed.',
      prompt: 'Take it, and do not make me ask twice.',
    }),
    guarded: Object.freeze({
      recognition: 'You are measuring every exit. Keep doing that.',
      offer: 'This packet is lighter than it looks and worse than it sounds.',
      prompt: 'Take it only if you are done pretending this was an accident.',
    }),
  });

const DEFAULT_TONE: IoSecondPacketReturnTone = 'guarded';

export const IO_SECOND_PACKET_RETURN_TONES: readonly IoSecondPacketReturnTone[] =
  Object.freeze(['gentle', 'defiant', 'guarded'] as const);

export function normalizeReturnTone(
  returnTone: unknown,
): IoSecondPacketReturnTone {
  return typeof returnTone === 'string'
    && Object.prototype.hasOwnProperty.call(RETURN_TONE_LINES, returnTone)
    ? (returnTone as IoSecondPacketReturnTone)
    : DEFAULT_TONE;
}

export interface IoSecondPacketChoice {
  readonly id: 'accept-second-packet' | 'ask-what-changed';
  readonly label: string;
  readonly response: string;
}

export interface IoSecondPacketCopy {
  readonly id: typeof IO_SECOND_PACKET_COPY_ID;
  readonly speaker: 'Io';
  readonly tone: IoSecondPacketReturnTone;
  readonly lines: readonly [string, string, string];
  readonly choices: readonly [IoSecondPacketChoice, IoSecondPacketChoice];
}

export interface SelectIoSecondPacketCopyInput {
  readonly returnTone?: unknown;
  readonly playerName?: unknown;
}

export function selectIoSecondPacketCopy(
  input: SelectIoSecondPacketCopyInput = {},
): IoSecondPacketCopy {
  const tone = normalizeReturnTone(input.returnTone);
  const lines = RETURN_TONE_LINES[tone];
  const name = typeof input.playerName === 'string' ? input.playerName.trim() : '';
  const address = name ? `${name}. ` : '';

  return Object.freeze({
    id: IO_SECOND_PACKET_COPY_ID,
    speaker: 'Io',
    tone,
    lines: Object.freeze([
      lines.recognition,
      `${address}${lines.offer}`,
      lines.prompt,
    ] as [string, string, string]),
    choices: Object.freeze([
      Object.freeze({
        id: 'accept-second-packet',
        label: 'Take the second packet',
        response: 'Then keep it close. The city has learned your weight.',
      } as const),
      Object.freeze({
        id: 'ask-what-changed',
        label: 'Ask what changed',
        response: 'You did. That is the part the route noticed.',
      } as const),
    ] as [IoSecondPacketChoice, IoSecondPacketChoice]),
  });
}

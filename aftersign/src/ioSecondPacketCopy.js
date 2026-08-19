export const IO_SECOND_PACKET_COPY_ID = 'io-second-packet-offer';

const RETURN_TONE_LINES = Object.freeze({
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

const DEFAULT_TONE = 'guarded';

export function normalizeReturnTone(returnTone) {
  return Object.prototype.hasOwnProperty.call(RETURN_TONE_LINES, returnTone)
    ? returnTone
    : DEFAULT_TONE;
}

export function selectIoSecondPacketCopy({ returnTone, playerName } = {}) {
  const tone = normalizeReturnTone(returnTone);
  const lines = RETURN_TONE_LINES[tone];
  const name = typeof playerName === 'string' ? playerName.trim() : '';
  const address = name ? `${name}. ` : '';

  return Object.freeze({
    id: IO_SECOND_PACKET_COPY_ID,
    speaker: 'Io',
    tone,
    lines: Object.freeze([
      lines.recognition,
      `${address}${lines.offer}`,
      lines.prompt,
    ]),
    choices: Object.freeze([
      Object.freeze({
        id: 'accept-second-packet',
        label: 'Take the second packet',
        response: 'Then keep it close. The city has learned your weight.',
      }),
      Object.freeze({
        id: 'ask-what-changed',
        label: 'Ask what changed',
        response: 'You did. That is the part the route noticed.',
      }),
    ]),
  });
}

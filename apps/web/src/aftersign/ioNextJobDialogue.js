const RETURN_TONE_LINES = Object.freeze({
  kind: Object.freeze({
    prompt: 'You came back because someone kept the lamp on.',
    reply: 'Kind answer. Dangerous habit. Vey will spend it if you let her.',
    ledger: 'return-tone:kind',
  }),
  evasive: Object.freeze({
    prompt: 'You came back because the road turned under you.',
    reply: 'Evasive answer. Fine. Couriers are allowed one locked drawer.',
    ledger: 'return-tone:evasive',
  }),
  blunt: Object.freeze({
    prompt: 'You came back because the job is not finished.',
    reply: 'Blunt answer. Useful. I can hang weight from it.',
    ledger: 'return-tone:blunt',
  }),
});

const NEXT_JOB_HANDOFF = Object.freeze({
  id: 'io-next-job-stitched-name',
  title: 'The stitched name',
  offer: 'Good. Then take this before the rain learns it.',
  packet: 'Not a packet this time. A name, stitched shut.',
  route: 'Saint Orra hangs over the old pharmacy. If she calls you by the wrong name, answer anyway.',
  warning: 'Do not open it. Do not correct it. Do not let Niko make it sound easy.',
  accept: 'Carry it to Orra.',
  decline: 'Leave it on Io’s counter.',
});

export function getIoReturnToneChoices() {
  return Object.entries(RETURN_TONE_LINES).map(([tone, copy]) => ({
    tone,
    prompt: copy.prompt,
    ledger: copy.ledger,
  }));
}

export function getIoReturnToneReply(tone) {
  return RETURN_TONE_LINES[tone]?.reply ?? RETURN_TONE_LINES.evasive.reply;
}

export function getIoNextJobHandoff() {
  return { ...NEXT_JOB_HANDOFF };
}

export function buildIoContinueBeat(tone) {
  return {
    beatId: 'io-continue-next-job',
    tone: RETURN_TONE_LINES[tone] ? tone : 'evasive',
    reply: getIoReturnToneReply(tone),
    handoff: getIoNextJobHandoff(),
  };
}

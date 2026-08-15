export const AFTERSIGN_NEXT_JOB_BEAT_ID = 'io-next-job';

export const AFTERSIGN_NEXT_JOB_BEAT = Object.freeze({
  id: AFTERSIGN_NEXT_JOB_BEAT_ID,
  title: 'The next job',
  speaker: 'Io',
  trigger: 'after-return-tone-choice',
  line: 'Good. Keep that shape. I have another delivery, and this one will know if you hesitate.',
  objective: 'Take Io’s second packet and carry it past the place that remembered you.',
  choices: Object.freeze([
    Object.freeze({
      id: 'take-it-now',
      label: 'Take it now.',
      response: 'Then move. The city only opens its mouth once.'
    }),
    Object.freeze({
      id: 'ask-why-you',
      label: 'Ask why it has to be you.',
      response: 'Because it already knows your footsteps. Strangers get eaten.'
    })
  ])
});

export function getAftersignNextJobBeat() {
  return AFTERSIGN_NEXT_JOB_BEAT;
}

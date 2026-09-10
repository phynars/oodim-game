export type EasingName =
  | 'linear'
  | 'easeOutCubic'
  | 'easeOutBack'
  | 'easeOutQuad'
  | 'easeInOutSine';

export interface InteractionFeelCue {
  readonly id: string;
  readonly durationMs: number;
  readonly delayMs?: number;
  readonly easing: EasingName;
  readonly scaleFrom?: number;
  readonly scaleTo?: number;
  readonly translateYPx?: number;
  readonly shakeXPx?: number;
  readonly shakeYDeg?: number;
  readonly opacityFrom?: number;
  readonly opacityTo?: number;
  readonly audioGainDb?: number;
}

export interface InteractionFeelSpec {
  readonly id: string;
  readonly motionSafe: readonly InteractionFeelCue[];
  readonly reducedMotion: readonly InteractionFeelCue[];
  readonly acceptance: {
    readonly maxMotionMs: number;
    readonly maxShakeXPx: number;
    readonly requiresAudioCouplingWithinMs: number;
    readonly requiresPhoneViewport: { readonly width: number; readonly height: number };
  };
}

export const PACKET_CONFIRM_FEEL: InteractionFeelSpec = {
  id: 'packet-confirm',
  motionSafe: [
    {
      id: 'button-pop-in',
      durationMs: 96,
      easing: 'easeOutBack',
      scaleFrom: 0.94,
      scaleTo: 1.04,
      translateYPx: -2,
      audioGainDb: -12,
    },
    {
      id: 'button-settle',
      delayMs: 96,
      durationMs: 84,
      easing: 'easeOutCubic',
      scaleFrom: 1.04,
      scaleTo: 1,
      translateYPx: 0,
    },
    {
      id: 'hud-confirm-shake',
      durationMs: 140,
      easing: 'easeInOutSine',
      shakeXPx: 3,
      shakeYDeg: 0.18,
      audioGainDb: -18,
    },
  ],
  reducedMotion: [
    {
      id: 'button-opacity-ack',
      durationMs: 120,
      easing: 'easeOutQuad',
      opacityFrom: 0.72,
      opacityTo: 1,
      audioGainDb: -18,
    },
  ],
  acceptance: {
    maxMotionMs: 180,
    maxShakeXPx: 3,
    requiresAudioCouplingWithinMs: 40,
    requiresPhoneViewport: { width: 390, height: 844 },
  },
};

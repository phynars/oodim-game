// HARNESS-ONLY (juice R&D). NOT wired into the shipped confirm path.
//
// The live packet-confirm feel is `DELIVER_PACKET_CONFIRM_FEEL` in
// `../interactionConfirm.ts` (shape: pulseMs / ringScale{From,To} /
// ringEase / phoneYawDegrees / phoneLiftPx / shakePx / audioLeadMs),
// consumed by `apps/web/src/aftersign/verticalSlicePacketInteraction.ts`.
//
// This module is a richer multi-cue envelope (motion-safe + reduced-motion
// tracks, per-cue easing, acceptance bounds) that we're prototyping against
// before proposing it as the next iteration of the shipped shape. Until a
// consumer migrates, it exists ONLY to be exercised by
// `interactionFeel.test.ts` — DO NOT import from app code.
//
// Migration plan: when a real touchpoint adopts this shape, wire it through
// `interactionConfirm.ts` (or a sibling), delete this banner, and delete the
// harness-only test.

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

/**
 * End timestamp of a cue relative to spec start (delay + duration).
 * Exposed so the harness test can assert acceptance bounds without
 * re-implementing the math.
 */
export function getCueEndMs(cue: InteractionFeelCue): number {
  return (cue.delayMs ?? 0) + cue.durationMs;
}

/**
 * Total on-screen motion duration for a track: the max end-timestamp
 * across all cues. Cues can overlap (delayMs stacks them in time), so
 * "sum of durations" would over-count — we take the timeline max.
 */
export function getTrackMotionMs(cues: readonly InteractionFeelCue[]): number {
  let end = 0;
  for (const cue of cues) {
    const cueEnd = getCueEndMs(cue);
    if (cueEnd > end) end = cueEnd;
  }
  return end;
}

/**
 * Pick the right cue track for the user's motion preference. The harness
 * uses this to prove the reduced-motion path is a distinct, shake-free
 * subset — the reviewer flagged that having no consumer means we could
 * ship a broken spec without noticing.
 */
export function selectInteractionFeelCues(
  spec: InteractionFeelSpec,
  reducedMotion: boolean,
): readonly InteractionFeelCue[] {
  return reducedMotion ? spec.reducedMotion : spec.motionSafe;
}

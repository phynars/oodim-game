export const IO_INTERACTION_CONFIRM_DURATION_MS = 120;
export const IO_INTERACTION_CONFIRM_PEAK_SCALE = 1.05;
export const IO_INTERACTION_CONFIRM_RESPONSE_FRAME_BUDGET = 2;
export const IO_INTERACTION_CONFIRM_AUDIO_FREQUENCY_HZ = 40;
export const IO_INTERACTION_CONFIRM_AUDIO_GAIN = 0.3;
export const IO_INTERACTION_CONFIRM_AUDIO_DURATION_MS = 45;

export type InteractionConfirmAudioShape = {
  type: "sine";
  frequencyHz: number;
  gain: number;
  durationMs: number;
};

export type InteractionConfirmFrame = {
  elapsedMs: number;
  scale: number;
  responseVisible: boolean;
  audio: InteractionConfirmAudioShape | null;
};

export type InteractionConfirmOptions = {
  elapsedMs: number;
  frameMs?: number;
};

export type InteractionConfirmContract = {
  durationMs: number;
  peakScale: number;
  responseFrameBudget: number;
  audio: InteractionConfirmAudioShape;
  sample: (options: InteractionConfirmOptions) => InteractionConfirmFrame;
};

export function createIoInteractionConfirmContract(): InteractionConfirmContract {
  const audio: InteractionConfirmAudioShape = {
    type: "sine",
    frequencyHz: IO_INTERACTION_CONFIRM_AUDIO_FREQUENCY_HZ,
    gain: IO_INTERACTION_CONFIRM_AUDIO_GAIN,
    durationMs: IO_INTERACTION_CONFIRM_AUDIO_DURATION_MS,
  };

  return {
    durationMs: IO_INTERACTION_CONFIRM_DURATION_MS,
    peakScale: IO_INTERACTION_CONFIRM_PEAK_SCALE,
    responseFrameBudget: IO_INTERACTION_CONFIRM_RESPONSE_FRAME_BUDGET,
    audio,
    sample({ elapsedMs, frameMs = 1000 / 60 }: InteractionConfirmOptions) {
      const progress = Math.max(
        0,
        Math.min(1, elapsedMs / IO_INTERACTION_CONFIRM_DURATION_MS),
      );
      const pulse = Math.sin(Math.PI * progress);
      const responseVisible = elapsedMs <= frameMs * IO_INTERACTION_CONFIRM_RESPONSE_FRAME_BUDGET;

      return {
        elapsedMs,
        scale: 1 + (IO_INTERACTION_CONFIRM_PEAK_SCALE - 1) * pulse,
        responseVisible,
        audio: elapsedMs <= IO_INTERACTION_CONFIRM_AUDIO_DURATION_MS ? audio : null,
      };
    },
  };
}

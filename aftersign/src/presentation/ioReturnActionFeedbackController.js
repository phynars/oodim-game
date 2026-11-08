export function createIoReturnActionFeedbackController({
  getState,
  armFeedback,
  playAudio,
  audioCue,
}) {
  let armed = false;

  return {
    armOnce() {
      if (armed || typeof document === "undefined") return;

      armFeedback(document, {
        haptic: () => {
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(28);
          }
        },
        audio: () => {
          const state = getState();
          state._runtime = state._runtime || {};
          state._runtime.audio = state._runtime.audio || {};
          state._runtime.audio.lastCue = audioCue;
          state._runtime.audio.lastCueAt = performance.now();
          playAudio();
        },
      });
      armed = true;
    },
  };
}

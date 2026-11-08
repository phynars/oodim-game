// PR #1885 (AI008): arm ONCE on `document`. The return-action fork
// re-renders every frame and replaces its button nodes, so the
// listener matches buttons by data-attribute rather than by node.
//
// The audio callback stamps `lastCue`/`lastCueAt` BEFORE `playAudio()`.
// That way the cue survives an autoplay-suspended AudioContext, the
// same way `playFailureStingAudio` handles it.
//
// Do NOT add a beat-gate here. `choose()` fires synchronously on
// `pointerup`, so by the time the 28ms coupling timer runs the beat has
// already advanced past `io-return-recognition`, and a gate would drop
// every cue. Off-beat protection lives in main.js instead: the
// return-tone-choice branch removes the feedback-target tags, so the
// selector matches nothing.
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

export const MEMORY_RECALL_ONSET = Object.freeze({
  hapticDurationMs: 18,
  cameraPushDurationMs: 120,
  cameraPushDistance: 0.04,
  cameraPushEasing: "ease-out",
  audioDuckDurationMs: 90,
  audioDuckDb: -6,
});

export function playMemoryRecallOnset({
  camera,
  audio,
  haptic = navigator?.vibrate,
}: {
  camera?: { position?: { z: number } };
  audio?: { gain?: { value: number } };
  haptic?: (duration: number) => boolean;
} = {}) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  try {
    haptic?.(MEMORY_RECALL_ONSET.hapticDurationMs);

    const startZ = camera?.position?.z;
    if (camera?.position && typeof startZ === "number") {
      const animation = document.documentElement.animate(
        [{ transform: "translateZ(0)" }, { transform: `translateZ(${MEMORY_RECALL_ONSET.cameraPushDistance}px)` }, { transform: "translateZ(0)" }],
        { duration: MEMORY_RECALL_ONSET.cameraPushDurationMs, easing: MEMORY_RECALL_ONSET.cameraPushEasing },
      );
      animation.finished.finally(() => {
        camera.position!.z = startZ;
      });
    }

    const gain = audio?.gain;
    if (gain) {
      const startGain = gain.value;
      gain.value = startGain * Math.pow(10, MEMORY_RECALL_ONSET.audioDuckDb / 20);
      window.setTimeout(() => {
        gain.value = startGain;
      }, MEMORY_RECALL_ONSET.audioDuckDurationMs);
    }
  } catch {
    // Feedback is optional and must never interrupt the recalled line.
  }
}

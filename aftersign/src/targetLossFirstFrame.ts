// Holds a target-loss envelope at its visible first frame until the render
// loop has acknowledged it. This keeps a cold first frame from consuming the
// entire 100ms prompt fade before the player can see it.
export const targetLossElapsedMs = (
  armedAtMs: number | null,
  nowMs: number,
  pendingFirstFrame: boolean,
): number => {
  if (armedAtMs === null) return 0;
  return pendingFirstFrame ? 0 : Math.max(0, nowMs - armedAtMs);
};

// AFTERSIGN presentation boundary: projects already-computed feedback envelopes
// onto the player-visible DOM. It deliberately owns no input or game state.

/**
 * Create the DOM feedback renderer used by the frame loop.
 *
 * @param {{ document: Document, failureSting: HTMLElement | null }} dependencies
 */
export function createFeedbackController({ document, failureSting }) {
  const rootStyle = document.documentElement.style;

  /**
   * Render transient confirmation/failure feedback for the current frame.
   * @param {{ confirmEnvelope: { hudShakeX: number, hudLiftY: number, reticleScale: number, reticleLiftPx: number }, failureEnvelope: { flashAlpha: number }, failureWobble: number, failureFalloff: number, failureFeel: { hudShakePx: number, hudDropPx: number } }} frame
   */
  function renderFrame({
    confirmEnvelope,
    failureEnvelope,
    failureWobble,
    failureFalloff,
    failureFeel,
  }) {
    rootStyle.setProperty(
      "--confirm-shake-x",
      `${confirmEnvelope.hudShakeX - Math.round(failureWobble * failureFeel.hudShakePx)}px`,
    );
    rootStyle.setProperty(
      "--confirm-shake-y",
      `${confirmEnvelope.hudLiftY + Math.round(failureFalloff * failureFeel.hudDropPx)}px`,
    );
    rootStyle.setProperty(
      "--confirm-reticle-scale",
      `${confirmEnvelope.reticleScale.toFixed(3)}`,
    );
    rootStyle.setProperty(
      "--confirm-reticle-y",
      `${confirmEnvelope.reticleLiftPx.toFixed(2)}px`,
    );
    if (failureSting) {
      failureSting.style.opacity = `${failureEnvelope.flashAlpha.toFixed(3)}`;
    }
  }

  return { renderFrame };
}

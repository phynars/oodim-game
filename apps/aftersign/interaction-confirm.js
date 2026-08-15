/**
 * AFTERSIGN interaction-confirm feedback.
 *
 * Player-visible goal: when a visible interaction choice is accepted, the
 * target reticle answers immediately: a short scale pop, a tiny screen nudge,
 * and a paired 880Hz confirmation chirp. Keep this client-side and reversible;
 * it is juice layered on top of story input, not state authority.
 */

export const INTERACTION_CONFIRM_FEEL = Object.freeze({
  durationMs: 180,
  reticleScalePeak: 1.18,
  reticleSettleScale: 1,
  nudgePx: 5,
  toneHz: 880,
  toneDurationMs: 70,
  toneAttackMs: 6,
  toneReleaseMs: 44,
  easing: 'cubic-bezier(.18, .89, .32, 1.28)',
});

const STYLE_ID = 'aftersign-interaction-confirm-style';
const RETICLE_CLASS = 'aftersign-interaction-reticle';
const CONFIRM_CLASS = 'is-confirming-interaction';

export function ensureInteractionConfirmStyles(documentRef = document) {
  if (documentRef.getElementById(STYLE_ID)) return;

  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${RETICLE_CLASS} {
      transform-origin: center;
      will-change: transform, filter;
    }

    .${RETICLE_CLASS}.${CONFIRM_CLASS} {
      animation: aftersign-reticle-confirm ${INTERACTION_CONFIRM_FEEL.durationMs}ms ${INTERACTION_CONFIRM_FEEL.easing} both;
      filter: drop-shadow(0 0 10px rgba(140, 224, 255, .72));
    }

    @keyframes aftersign-reticle-confirm {
      0% { transform: translate3d(0, 0, 0) scale(1); }
      28% { transform: translate3d(0, -${INTERACTION_CONFIRM_FEEL.nudgePx}px, 0) scale(${INTERACTION_CONFIRM_FEEL.reticleScalePeak}); }
      62% { transform: translate3d(0, 1px, 0) scale(.985); }
      100% { transform: translate3d(0, 0, 0) scale(${INTERACTION_CONFIRM_FEEL.reticleSettleScale}); }
    }

    @media (prefers-reduced-motion: reduce) {
      .${RETICLE_CLASS}.${CONFIRM_CLASS} {
        animation: aftersign-reticle-confirm-reduced ${INTERACTION_CONFIRM_FEEL.durationMs}ms ease-out both;
      }

      @keyframes aftersign-reticle-confirm-reduced {
        0% { transform: scale(1); }
        35% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
    }
  `;
  documentRef.head.appendChild(style);
}

export function markInteractionReticle(element) {
  if (!element) return null;
  element.classList.add(RETICLE_CLASS);
  return element;
}

export function playInteractionConfirm({
  reticle,
  audioContext = null,
  nowMs = performance.now(),
  documentRef = document,
} = {}) {
  ensureInteractionConfirmStyles(documentRef);

  if (reticle) {
    markInteractionReticle(reticle);
    reticle.classList.remove(CONFIRM_CLASS);
    // Force animation restart when the player confirms repeated choices quickly.
    void reticle.offsetWidth;
    reticle.classList.add(CONFIRM_CLASS);
    window.setTimeout(() => reticle.classList.remove(CONFIRM_CLASS), INTERACTION_CONFIRM_FEEL.durationMs);
  }

  const startedTone = playConfirmTone(audioContext);

  return {
    kind: 'interaction-confirm',
    atMs: nowMs,
    durationMs: INTERACTION_CONFIRM_FEEL.durationMs,
    reticleScalePeak: INTERACTION_CONFIRM_FEEL.reticleScalePeak,
    nudgePx: INTERACTION_CONFIRM_FEEL.nudgePx,
    toneHz: startedTone ? INTERACTION_CONFIRM_FEEL.toneHz : 0,
  };
}

function playConfirmTone(audioContext) {
  if (!audioContext) return false;

  const startAt = audioContext.currentTime;
  const attackSeconds = INTERACTION_CONFIRM_FEEL.toneAttackMs / 1000;
  const releaseSeconds = INTERACTION_CONFIRM_FEEL.toneReleaseMs / 1000;
  const totalSeconds = INTERACTION_CONFIRM_FEEL.toneDurationMs / 1000;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(INTERACTION_CONFIRM_FEEL.toneHz, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.08, startAt + attackSeconds);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(attackSeconds + releaseSeconds, totalSeconds));

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + totalSeconds);

  return true;
}

export function installInteractionConfirm(root = document, options = {}) {
  ensureInteractionConfirmStyles(root.ownerDocument || document);
  const audioContext = options.audioContext || null;

  root.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-aftersign-confirm]');
    if (!target) return;

    const reticleSelector = target.getAttribute('data-aftersign-reticle');
    const reticle = reticleSelector
      ? (root.ownerDocument || document).querySelector(reticleSelector)
      : target.querySelector(`.${RETICLE_CLASS}`) || target;

    playInteractionConfirm({ reticle, audioContext });
  });
}

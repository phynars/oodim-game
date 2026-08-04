const DEFAULT_CONFIRM_FEEL = Object.freeze({
  durationMs: 420,
  pulseMs: 180,
  settleMs: 240,
  liftPx: 10,
  squashScaleX: 1.08,
  squashScaleY: 0.92,
  bloomOpacity: 0.72,
  ringScaleStart: 0.82,
  ringScaleEnd: 1.36,
  shakePx: 2,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
});

let styleInstalled = false;

export function getAftersignConfirmFeel(overrides = {}) {
  return Object.freeze({
    ...DEFAULT_CONFIRM_FEEL,
    ...overrides,
  });
}

export function installAftersignConfirmFeelStyles(root = document) {
  if (styleInstalled || !root?.head) return;

  const style = root.createElement('style');
  style.dataset.aftersignConfirmFeel = 'true';
  style.textContent = `
    .aftersign-confirm-feel {
      pointer-events: none;
      position: fixed;
      inset: 0;
      z-index: 30;
      overflow: hidden;
    }

    .aftersign-confirm-feel__ring,
    .aftersign-confirm-feel__flash,
    .aftersign-confirm-feel__caption {
      position: absolute;
      left: var(--aftersign-confirm-x, 50%);
      top: var(--aftersign-confirm-y, 50%);
      transform: translate(-50%, -50%);
      will-change: transform, opacity, filter;
    }

    .aftersign-confirm-feel__ring {
      width: 86px;
      height: 86px;
      border: 2px solid rgba(142, 229, 255, 0.92);
      border-radius: 999px;
      box-shadow: 0 0 18px rgba(95, 212, 255, 0.46), inset 0 0 20px rgba(95, 212, 255, 0.18);
      animation: aftersign-confirm-ring var(--aftersign-confirm-duration, 420ms) var(--aftersign-confirm-ease, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
    }

    .aftersign-confirm-feel__flash {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(159,236,255,0.7) 34%, rgba(65,181,255,0) 72%);
      mix-blend-mode: screen;
      animation: aftersign-confirm-flash var(--aftersign-confirm-pulse, 180ms) ease-out forwards;
    }

    .aftersign-confirm-feel__caption {
      color: rgba(226, 249, 255, 0.96);
      font: 700 12px/1.1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(101, 213, 255, 0.64);
      transform: translate(-50%, calc(-50% - 34px));
      animation: aftersign-confirm-caption var(--aftersign-confirm-duration, 420ms) var(--aftersign-confirm-ease, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
    }

    @keyframes aftersign-confirm-ring {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(var(--aftersign-confirm-ring-start, 0.82)); filter: blur(1px); }
      18% { opacity: var(--aftersign-confirm-bloom, 0.72); transform: translate(calc(-50% + var(--aftersign-confirm-shake, 2px)), -50%) scale(1); filter: blur(0); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(var(--aftersign-confirm-ring-end, 1.36)); filter: blur(2px); }
    }

    @keyframes aftersign-confirm-flash {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
      35% { opacity: 0.96; transform: translate(-50%, -50%) scale(1.08, 0.92); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1.62); }
    }

    @keyframes aftersign-confirm-caption {
      0% { opacity: 0; transform: translate(-50%, calc(-50% - 24px)) scale(1.08, 0.92); }
      22% { opacity: 1; transform: translate(-50%, calc(-50% - 34px)) scale(1); }
      100% { opacity: 0; transform: translate(-50%, calc(-50% - 44px)); }
    }
  `;

  root.head.append(style);
  styleInstalled = true;
}

export function playAftersignConfirmFeel({
  root = document,
  x = globalThis.innerWidth ? globalThis.innerWidth / 2 : 0,
  y = globalThis.innerHeight ? globalThis.innerHeight / 2 : 0,
  label = 'Confirmed',
  feel = DEFAULT_CONFIRM_FEEL,
} = {}) {
  if (!root?.body) return null;

  const tunedFeel = getAftersignConfirmFeel(feel);
  installAftersignConfirmFeelStyles(root);

  const layer = root.createElement('div');
  layer.className = 'aftersign-confirm-feel';
  layer.style.setProperty('--aftersign-confirm-x', `${Math.round(x)}px`);
  layer.style.setProperty('--aftersign-confirm-y', `${Math.round(y)}px`);
  layer.style.setProperty('--aftersign-confirm-duration', `${tunedFeel.durationMs}ms`);
  layer.style.setProperty('--aftersign-confirm-pulse', `${tunedFeel.pulseMs}ms`);
  layer.style.setProperty('--aftersign-confirm-ease', tunedFeel.easing);
  layer.style.setProperty('--aftersign-confirm-bloom', String(tunedFeel.bloomOpacity));
  layer.style.setProperty('--aftersign-confirm-ring-start', String(tunedFeel.ringScaleStart));
  layer.style.setProperty('--aftersign-confirm-ring-end', String(tunedFeel.ringScaleEnd));
  layer.style.setProperty('--aftersign-confirm-shake', `${tunedFeel.shakePx}px`);

  const ring = root.createElement('div');
  ring.className = 'aftersign-confirm-feel__ring';

  const flash = root.createElement('div');
  flash.className = 'aftersign-confirm-feel__flash';

  const caption = root.createElement('div');
  caption.className = 'aftersign-confirm-feel__caption';
  caption.textContent = label;

  layer.append(ring, flash, caption);
  root.body.append(layer);

  const cleanupDelayMs = tunedFeel.durationMs + 80;
  const cleanup = () => layer.remove();
  const timer = globalThis.setTimeout?.(cleanup, cleanupDelayMs);

  return {
    layer,
    cleanup: () => {
      if (timer) globalThis.clearTimeout?.(timer);
      cleanup();
    },
    feel: tunedFeel,
  };
}

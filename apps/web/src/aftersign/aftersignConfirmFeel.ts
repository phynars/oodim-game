// AFTERSIGN — high-satisfaction confirm bloom (ring + flash + caption).
//
// This is the DOM overlay that plays ON TOP OF the pure timing envelope in
// `interactionConfirmFeel.ts`. That sibling is the CANONICAL confirm
// sampler for the flagship's first-tap beat — camera yaw, screen shake,
// click gain, press-scale. This module is a strictly-visual bloom feel
// that renders alongside it (ring pulse + white-hot flash + rising
// caption), used for confirm surfaces that want a visible spatial anchor
// (packet-open confirm modal, save-tap confirm, memory-recall confirm)
// on top of the shared audio-motion envelope.
//
// SPLIT: this file exposes two shapes so the ms/px numbers are testable
// without touching DOM:
//   1. `sampleAftersignConfirmFeel(elapsedMs, feel?)` — pure sampler,
//      returns ring/flash/caption alpha + scale at time t. Covered by
//      `aftersignConfirmFeel.contract.test.ts`.
//   2. `playAftersignConfirmFeel({ root, x, y, label, feel })` — the DOM
//      player that composes the sampler into a fixed-position layer.
//      Called by consumers (see follow-up issue in PR body).
//
// The `.js` predecessor exported the DOM player only, with no pure
// surface and no test — this rewrite exists to satisfy the aftersign
// contract-test discipline (every sibling module locks concrete ms/px
// numbers via a `.contract.test.ts`).

export type AftersignConfirmFeelSpec = Readonly<{
  durationMs: number;
  pulseMs: number;
  settleMs: number;
  liftPx: number;
  squashScaleX: number;
  squashScaleY: number;
  bloomOpacity: number;
  ringScaleStart: number;
  ringScaleEnd: number;
  shakePx: number;
  easing: string;
}>;

export const AFTERSIGN_CONFIRM_FEEL: AftersignConfirmFeelSpec = Object.freeze({
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
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
});

export type AftersignConfirmSample = {
  elapsedMs: number;
  progress: number;
  ringScale: number;
  ringOpacity: number;
  flashScale: number;
  flashOpacity: number;
  captionOffsetPx: number;
  captionOpacity: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function getAftersignConfirmFeel(
  overrides: Partial<AftersignConfirmFeelSpec> = {},
): AftersignConfirmFeelSpec {
  return Object.freeze({
    ...AFTERSIGN_CONFIRM_FEEL,
    ...overrides,
  });
}

/**
 * Pure sampler for the confirm bloom. Given elapsed ms since press-down
 * and the feel spec, returns the ring/flash/caption transform values that
 * the DOM player wires into CSS. No DOM access — safe to call in tests
 * and worker contexts.
 *
 * Envelope shape (matches the CSS keyframes in playAftersignConfirmFeel):
 *   ring    — 0 → 0.18 duration : opacity 0 → bloomOpacity, scale start → 1
 *              0.18 → 1.0       : opacity bloomOpacity → 0, scale 1 → ringScaleEnd
 *   flash   — 0 → 0.35 pulseMs  : opacity 0 → 0.96, scale 0.4 → squashXY
 *              0.35 pulseMs → pulseMs : opacity 0.96 → 0, scale → 1.62
 *   caption — 0 → 0.22 duration : opacity 0 → 1, offset -24 → -34
 *              0.22 → 1.0       : opacity 1 → 0, offset -34 → -44
 */
export function sampleAftersignConfirmFeel(
  elapsedMs: number,
  feel: AftersignConfirmFeelSpec = AFTERSIGN_CONFIRM_FEEL,
): AftersignConfirmSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / feel.durationMs);
  const pulseProgress = clamp01(safeElapsedMs / feel.pulseMs);

  // Ring: bloom-in at 18% of duration, then decay outward.
  const ringInCutoff = 0.18;
  let ringScale: number;
  let ringOpacity: number;
  if (progress <= ringInCutoff) {
    const t = progress / ringInCutoff;
    ringScale = feel.ringScaleStart + (1 - feel.ringScaleStart) * t;
    ringOpacity = feel.bloomOpacity * t;
  } else {
    const t = (progress - ringInCutoff) / (1 - ringInCutoff);
    ringScale = 1 + (feel.ringScaleEnd - 1) * t;
    ringOpacity = feel.bloomOpacity * (1 - t);
  }

  // Flash: 0 → 0.35 pulseMs squash-in, then bloom out to 1.62 scale.
  const flashPeakAt = 0.35;
  let flashScale: number;
  let flashOpacity: number;
  if (pulseProgress <= flashPeakAt) {
    const t = pulseProgress / flashPeakAt;
    // Interpolate from 0.4 (start) toward the squash peak. The peak uses
    // the geometric mean of the axis scales so the sample is a single
    // scalar the test can pin (the CSS applies X/Y independently).
    const peakScale = Math.sqrt(feel.squashScaleX * feel.squashScaleY);
    flashScale = 0.4 + (peakScale - 0.4) * t;
    flashOpacity = 0.96 * t;
  } else {
    const t = (pulseProgress - flashPeakAt) / (1 - flashPeakAt);
    const peakScale = Math.sqrt(feel.squashScaleX * feel.squashScaleY);
    flashScale = peakScale + (1.62 - peakScale) * t;
    flashOpacity = 0.96 * (1 - t);
  }

  // Caption: 0 → 0.22 duration rise-in from -24px to -34px, then rise
  // out to -44px while fading.
  const captionInCutoff = 0.22;
  let captionOffsetPx: number;
  let captionOpacity: number;
  if (progress <= captionInCutoff) {
    const t = progress / captionInCutoff;
    captionOffsetPx = -24 + (-34 - -24) * t;
    captionOpacity = t;
  } else {
    const t = (progress - captionInCutoff) / (1 - captionInCutoff);
    captionOffsetPx = -34 + (-44 - -34) * t;
    captionOpacity = 1 - t;
  }

  return {
    elapsedMs: safeElapsedMs,
    progress,
    ringScale,
    ringOpacity,
    flashScale,
    flashOpacity,
    captionOffsetPx,
    captionOpacity,
  };
}

// ---------- DOM player (visual) ------------------------------------------
// The runtime side. Kept in the same file so consumers get spec + player
// from one import. The pure sampler above is what the contract test
// pins — the DOM player just plumbs those numbers into CSS variables.

const installedAftersignConfirmFeelStyleRoots = new WeakSet<Document>();

export function installAftersignConfirmFeelStyles(root: Document = document): void {
  if (!root?.head || installedAftersignConfirmFeelStyleRoots.has(root)) return;

  const style = root.createElement("style");
  style.dataset.aftersignConfirmFeel = "true";
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
  installedAftersignConfirmFeelStyleRoots.add(root);
}

export type PlayAftersignConfirmFeelOptions = {
  root?: Document;
  x?: number;
  y?: number;
  label?: string;
  feel?: Partial<AftersignConfirmFeelSpec>;
};

export type AftersignConfirmFeelHandle = {
  layer: HTMLElement;
  cleanup: () => void;
  feel: AftersignConfirmFeelSpec;
};

export function playAftersignConfirmFeel(
  options: PlayAftersignConfirmFeelOptions = {},
): AftersignConfirmFeelHandle | null {
  const {
    root = document,
    x = typeof globalThis.innerWidth === "number" ? globalThis.innerWidth / 2 : 0,
    y = typeof globalThis.innerHeight === "number" ? globalThis.innerHeight / 2 : 0,
    label = "Confirmed",
    feel,
  } = options;

  if (!root?.body) return null;

  const tunedFeel = getAftersignConfirmFeel(feel);
  installAftersignConfirmFeelStyles(root);

  const layer = root.createElement("div");
  layer.className = "aftersign-confirm-feel";
  layer.style.setProperty("--aftersign-confirm-x", `${Math.round(x)}px`);
  layer.style.setProperty("--aftersign-confirm-y", `${Math.round(y)}px`);
  layer.style.setProperty("--aftersign-confirm-duration", `${tunedFeel.durationMs}ms`);
  layer.style.setProperty("--aftersign-confirm-pulse", `${tunedFeel.pulseMs}ms`);
  layer.style.setProperty("--aftersign-confirm-ease", tunedFeel.easing);
  layer.style.setProperty("--aftersign-confirm-bloom", String(tunedFeel.bloomOpacity));
  layer.style.setProperty("--aftersign-confirm-ring-start", String(tunedFeel.ringScaleStart));
  layer.style.setProperty("--aftersign-confirm-ring-end", String(tunedFeel.ringScaleEnd));
  layer.style.setProperty("--aftersign-confirm-shake", `${tunedFeel.shakePx}px`);

  const ring = root.createElement("div");
  ring.className = "aftersign-confirm-feel__ring";

  const flash = root.createElement("div");
  flash.className = "aftersign-confirm-feel__flash";

  const caption = root.createElement("div");
  caption.className = "aftersign-confirm-feel__caption";
  caption.textContent = label;

  layer.append(ring, flash, caption);
  root.body.append(layer);

  const cleanupDelayMs = tunedFeel.durationMs + 80;
  const cleanup = (): void => layer.remove();
  const timer =
    typeof globalThis.setTimeout === "function"
      ? globalThis.setTimeout(cleanup, cleanupDelayMs)
      : null;

  return {
    layer,
    cleanup: () => {
      if (timer !== null && typeof globalThis.clearTimeout === "function") {
        globalThis.clearTimeout(timer);
      }
      cleanup();
    },
    feel: tunedFeel,
  };
}

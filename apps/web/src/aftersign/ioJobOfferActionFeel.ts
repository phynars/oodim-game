// AFTERSIGN — offered-job action feel (tap-driven press for the
// job-offer action buttons on the flagship's aftersign surface).
//
// Three tones (safe / risky / consequence) each pin ms/px/easing/glow
// numbers. This module exposes:
//
//   1. `AFTERSIGN_JOB_OFFER_ACTION_FEEL` — the pinned table (spec).
//   2. `resolveAftersignJobOfferActionFeel(risk)` — pure resolver.
//   3. `getAftersignJobOfferActionFeelAttributes(risk)` — attribute bag
//      a component can spread onto an element in any framework.
//   4. `installAftersignJobOfferActionFeelStyles(root)` — installs the
//      CSS block that renders lift / press-scale / glow / border-pulse
//      from the stamped `data-aftersign-feel-*` attributes + CSS vars.
//   5. `applyAftersignJobOfferActionFeel(el, risk)` — stamps attributes
//      + the CSS custom properties onto an existing element.
//   6. `renderAftersignJobOfferActionButton({root, risk, label})` — the
//      runtime consumer: builds a real `<button>`, stamps the feel,
//      wires pointerdown/up so the press-scale + glow actually play.
//
// The consumer test (`ioJobOfferActionFeel.consumer.test.ts`) drives
// the rendered button via jsdom `pointerdown` / `pointerup` and asserts
// the pressed class + CSS variables land end-to-end. The reviewer's
// blocking feedback on PR #1576 was that the attributes were inert —
// this file now ships a consumer + a tap-driven test so the attributes
// render feel.

export type AftersignJobRiskTone = "safe" | "risky" | "consequence";

export interface AftersignJobOfferActionFeel {
  readonly durationMs: number;
  readonly liftPx: number;
  readonly pressScale: number;
  readonly glowAlpha: number;
  readonly borderPulsePx: number;
  readonly easing: string;
  readonly audioCue: "soft-confirm" | "risk-chime" | "debt-thrum";
}

export const AFTERSIGN_JOB_OFFER_ACTION_FEEL: Record<AftersignJobRiskTone, AftersignJobOfferActionFeel> = {
  safe: {
    durationMs: 220,
    liftPx: 4,
    pressScale: 0.985,
    glowAlpha: 0.18,
    borderPulsePx: 1,
    easing: "cubic-bezier(.2,.8,.2,1)",
    audioCue: "soft-confirm",
  },
  risky: {
    durationMs: 280,
    liftPx: 6,
    pressScale: 0.975,
    glowAlpha: 0.26,
    borderPulsePx: 2,
    easing: "cubic-bezier(.16,1,.3,1)",
    audioCue: "risk-chime",
  },
  consequence: {
    durationMs: 340,
    liftPx: 5,
    pressScale: 0.98,
    glowAlpha: 0.32,
    borderPulsePx: 3,
    easing: "cubic-bezier(.34,1.56,.64,1)",
    audioCue: "debt-thrum",
  },
};

export interface AftersignJobOfferActionFeelAttributes {
  readonly "data-aftersign-job-risk": AftersignJobRiskTone;
  readonly "data-aftersign-feel-duration-ms": string;
  readonly "data-aftersign-feel-lift-px": string;
  readonly "data-aftersign-feel-press-scale": string;
  readonly "data-aftersign-feel-glow-alpha": string;
  readonly "data-aftersign-feel-border-pulse-px": string;
  readonly "data-aftersign-feel-easing": string;
  readonly "data-aftersign-feel-audio-cue": AftersignJobOfferActionFeel["audioCue"];
}

export function resolveAftersignJobOfferActionFeel(
  risk: AftersignJobRiskTone,
): AftersignJobOfferActionFeel {
  return AFTERSIGN_JOB_OFFER_ACTION_FEEL[risk];
}

export function getAftersignJobOfferActionFeelAttributes(
  risk: AftersignJobRiskTone,
): AftersignJobOfferActionFeelAttributes {
  const feel = resolveAftersignJobOfferActionFeel(risk);

  return {
    "data-aftersign-job-risk": risk,
    "data-aftersign-feel-duration-ms": String(feel.durationMs),
    "data-aftersign-feel-lift-px": String(feel.liftPx),
    "data-aftersign-feel-press-scale": String(feel.pressScale),
    "data-aftersign-feel-glow-alpha": String(feel.glowAlpha),
    "data-aftersign-feel-border-pulse-px": String(feel.borderPulsePx),
    "data-aftersign-feel-easing": feel.easing,
    "data-aftersign-feel-audio-cue": feel.audioCue,
  };
}

// ---------- DOM consumer -------------------------------------------------

/** CSS selector components/tests use to find these buttons. */
export const AFTERSIGN_JOB_OFFER_ACTION_SELECTOR =
  "[data-aftersign-job-risk]";

/** Class the DOM applier toggles for pointer-down state. */
export const AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS =
  "is-aftersign-job-offer-pressing";

const installedAftersignJobOfferActionFeelStyleRoots = new WeakSet<Document>();

/**
 * Install the CSS block that renders lift / press-scale / glow /
 * border-pulse from the `data-aftersign-feel-*` attributes and the
 * CSS custom properties `applyAftersignJobOfferActionFeel` stamps.
 *
 * Idempotent per document via a WeakSet, matching the pattern in
 * `aftersignConfirmFeel.ts`.
 */
export function installAftersignJobOfferActionFeelStyles(
  root: Document = document,
): void {
  if (!root?.head || installedAftersignJobOfferActionFeelStyleRoots.has(root)) {
    return;
  }

  const style = root.createElement("style");
  style.dataset.aftersignJobOfferActionFeel = "true";
  style.textContent = `
    [data-aftersign-job-risk] {
      position: relative;
      transition:
        transform var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        box-shadow var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        border-color var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1));
      will-change: transform, box-shadow;
      transform: translateY(0) scale(1);
    }

    [data-aftersign-job-risk]:hover,
    [data-aftersign-job-risk]:focus-visible {
      transform: translateY(calc(var(--aftersign-job-offer-lift, 4px) * -1)) scale(1);
      box-shadow:
        0 var(--aftersign-job-offer-lift, 4px) calc(var(--aftersign-job-offer-lift, 4px) * 3)
          rgba(120, 220, 255, var(--aftersign-job-offer-glow, 0.18)),
        inset 0 0 0 var(--aftersign-job-offer-border-pulse, 1px)
          rgba(180, 240, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.2));
    }

    [data-aftersign-job-risk].${AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS} {
      transform: translateY(0) scale(var(--aftersign-job-offer-press-scale, 0.985));
      box-shadow:
        0 0 calc(var(--aftersign-job-offer-lift, 4px) * 4)
          rgba(120, 220, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.12)),
        inset 0 0 0 var(--aftersign-job-offer-border-pulse, 1px)
          rgba(220, 250, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.32));
    }

    [data-aftersign-job-risk="risky"] {
      --aftersign-job-offer-tone: rgba(255, 196, 130, 0.28);
    }

    [data-aftersign-job-risk="consequence"] {
      --aftersign-job-offer-tone: rgba(255, 130, 150, 0.36);
      animation: aftersign-job-offer-debt-thrum 1800ms ease-in-out infinite;
    }

    @keyframes aftersign-job-offer-debt-thrum {
      0%, 100% { box-shadow: 0 0 0 rgba(255,130,150,0); }
      50% { box-shadow: 0 0 12px var(--aftersign-job-offer-tone, rgba(255,130,150,0.36)); }
    }

    @media (prefers-reduced-motion: reduce) {
      [data-aftersign-job-risk] {
        transition-duration: 0ms;
        animation: none;
      }
    }
  `;

  root.head.append(style);
  installedAftersignJobOfferActionFeelStyleRoots.add(root);
}

/**
 * Stamp the feel attributes + CSS custom properties onto an existing
 * element. Idempotent — calling twice with the same risk is a no-op
 * beyond re-writing the same values.
 *
 * This is the seam a framework component (React, Solid, plain DOM)
 * calls after it renders the element. It intentionally does NOT bind
 * pointer handlers — the caller owns the click/press wiring, this
 * function only writes what the CSS block needs to read.
 */
export function applyAftersignJobOfferActionFeel(
  el: HTMLElement,
  risk: AftersignJobRiskTone,
): AftersignJobOfferActionFeel {
  const feel = resolveAftersignJobOfferActionFeel(risk);
  const attrs = getAftersignJobOfferActionFeelAttributes(risk);

  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value);
  }

  el.style.setProperty("--aftersign-job-offer-duration", `${feel.durationMs}ms`);
  el.style.setProperty("--aftersign-job-offer-lift", `${feel.liftPx}px`);
  el.style.setProperty(
    "--aftersign-job-offer-press-scale",
    String(feel.pressScale),
  );
  el.style.setProperty("--aftersign-job-offer-glow", String(feel.glowAlpha));
  el.style.setProperty(
    "--aftersign-job-offer-border-pulse",
    `${feel.borderPulsePx}px`,
  );
  el.style.setProperty("--aftersign-job-offer-ease", feel.easing);

  return feel;
}

export type RenderAftersignJobOfferActionButtonOptions = {
  root?: Document;
  risk: AftersignJobRiskTone;
  label: string;
  onCommit?: (risk: AftersignJobRiskTone) => void;
};

export type AftersignJobOfferActionButtonHandle = {
  button: HTMLButtonElement;
  feel: AftersignJobOfferActionFeel;
  dispose: () => void;
};

/**
 * Runtime consumer: build a real `<button>` with the feel attributes,
 * CSS variables, and pointer handlers wired so the press-scale + glow
 * play on tap. Returns the button + a `dispose` that removes the
 * pointer listeners (the caller owns removal from the DOM).
 *
 * The consumer test drives THIS function — `pointerdown` on the
 * returned button must add the pressed class, `pointerup` must remove
 * it, and `click` must fire `onCommit(risk)`.
 */
export function renderAftersignJobOfferActionButton(
  options: RenderAftersignJobOfferActionButtonOptions,
): AftersignJobOfferActionButtonHandle {
  const { root = document, risk, label, onCommit } = options;

  installAftersignJobOfferActionFeelStyles(root);

  const button = root.createElement("button");
  button.type = "button";
  button.textContent = label;
  const feel = applyAftersignJobOfferActionFeel(button, risk);

  const setPressed = (pressed: boolean): void => {
    button.classList.toggle(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS, pressed);
  };

  const onDown = (): void => setPressed(true);
  const onUp = (): void => setPressed(false);
  const onLeave = (): void => setPressed(false);
  const onClick = (): void => onCommit?.(risk);

  button.addEventListener("pointerdown", onDown);
  button.addEventListener("pointerup", onUp);
  button.addEventListener("pointercancel", onLeave);
  button.addEventListener("pointerleave", onLeave);
  button.addEventListener("click", onClick);

  const dispose = (): void => {
    button.removeEventListener("pointerdown", onDown);
    button.removeEventListener("pointerup", onUp);
    button.removeEventListener("pointercancel", onLeave);
    button.removeEventListener("pointerleave", onLeave);
    button.removeEventListener("click", onClick);
  };

  return { button, feel, dispose };
}

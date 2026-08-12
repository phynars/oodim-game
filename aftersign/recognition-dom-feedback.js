const clamp01 = (value) => Math.max(0, Math.min(1, value));

const timedProgress = (elapsedMs, startMs, durationMs) =>
  clamp01((elapsedMs - startMs) / durationMs);

const easeOutCubic = (value) => 1 - ((1 - clamp01(value)) ** 3);
const easeInOutSine = (value) => (1 - Math.cos(Math.PI * clamp01(value))) / 2;
const bell = (value) => Math.sin(Math.PI * clamp01(value));

const cueIntensity = (cue, elapsedMs) => {
  if (!cue || elapsedMs < cue.startMs || elapsedMs > cue.startMs + cue.durationMs) {
    return 0;
  }

  const progress = timedProgress(elapsedMs, cue.startMs, cue.durationMs);
  if (cue.easing === "bell") return bell(progress);
  if (cue.easing === "easeInOutSine") return easeInOutSine(progress);
  return easeOutCubic(progress);
};

export const clearRecognitionDomFeedback = ({
  root = document.documentElement,
  lineNode = null,
  speakerNode = null,
  stateReadoutNode = null,
} = {}) => {
  if (root) {
    root.style.setProperty("--recognition-sign-glow", "0px");
    root.style.setProperty("--recognition-seal-glow", "0px");
    root.style.setProperty("--recognition-rain-rim-alpha", "0");
    root.style.setProperty("--recognition-haptic-scale", "1");
    root.style.setProperty("--recognition-warmth", "0");
  }
  [lineNode, speakerNode, stateReadoutNode].filter(Boolean).forEach((node) => {
    node.style.textShadow = "";
    node.style.transform = "";
  });
};

// Pure computation of the DOM-feedback snapshot at an instant — no DOM.
// Extracted (#1127/#1134) so the runtime's analytic beat report can sample
// the beat's authored feel at any timestamp without depending on how many
// frames the host actually painted (SwiftShader cold starts paint ~none).
export const computeRecognitionDomFeedback = ({
  elapsedMs = 0,
  outcome = "sealed",
  envelope,
} = {}) => {
  if (!envelope) {
    return {
      active: false,
      signGlowPx: 0,
      sealGlowPx: 0,
      rainRimAlpha: 0,
      hapticScale: 1,
      warmth: 0,
    };
  }
  const normalized = clamp01(envelope.normalized ?? 0);
  const active = normalized > 0 && normalized < 1;
  const lantern = cueIntensity(envelope.lantern, elapsedMs);
  const packetSeal = cueIntensity(envelope.packetSeal, elapsedMs);
  const kioskSign = cueIntensity(envelope.kioskSign, elapsedMs);
  const rainRim = cueIntensity(envelope.rainRim, elapsedMs);
  const haptic = cueIntensity(envelope.hapticScale, elapsedMs);
  const openedBias = outcome === "opened" ? 1 : 0;

  return {
    active,
    signGlowPx: active
      ? Number((8 + kioskSign * 18 + lantern * 10).toFixed(2))
      : 0,
    sealGlowPx: Number((packetSeal * (openedBias ? 11 : 15)).toFixed(2)),
    rainRimAlpha: Number((rainRim * (openedBias ? 0.28 : 0.2)).toFixed(3)),
    hapticScale: Number((1 + haptic * (envelope.hapticScale?.amplitude ?? 0)).toFixed(4)),
    warmth: Number((lantern * (openedBias ? 0.68 : 0.48) + packetSeal * 0.32).toFixed(3)),
  };
};

export const applyRecognitionDomFeedback = ({
  root = document.documentElement,
  lineNode = null,
  speakerNode = null,
  stateReadoutNode = null,
  elapsedMs = 0,
  outcome = "sealed",
  envelope,
} = {}) => {
  if (!root || !envelope) {
    return {
      active: false,
      signGlowPx: 0,
      sealGlowPx: 0,
      rainRimAlpha: 0,
      hapticScale: 1,
      warmth: 0,
    };
  }

  const normalized = clamp01(envelope.normalized ?? 0);
  const { active, signGlowPx, sealGlowPx, rainRimAlpha, hapticScale, warmth } =
    computeRecognitionDomFeedback({ elapsedMs, outcome, envelope });

  root.style.setProperty("--recognition-sign-glow", `${signGlowPx}px`);
  root.style.setProperty("--recognition-seal-glow", `${sealGlowPx}px`);
  root.style.setProperty("--recognition-rain-rim-alpha", `${rainRimAlpha}`);
  root.style.setProperty("--recognition-haptic-scale", `${hapticScale}`);
  root.style.setProperty("--recognition-warmth", `${warmth}`);

  const liftPx = Number((easeOutCubic(normalized) * -2).toFixed(2));
  const glow = `0 0 ${signGlowPx}px rgba(255, 217, 154, ${Math.min(0.72, 0.22 + warmth * 0.5)})`;
  [lineNode, speakerNode, stateReadoutNode].filter(Boolean).forEach((node) => {
    node.style.textShadow = glow;
    node.style.transform = `translateY(${liftPx}px) scale(${hapticScale})`;
  });

  return {
    active,
    signGlowPx,
    sealGlowPx,
    rainRimAlpha,
    hapticScale,
    warmth,
  };
};

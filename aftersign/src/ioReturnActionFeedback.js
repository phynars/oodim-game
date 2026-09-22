// Tactile feedback for the three visible Io return-action buttons.
// This module deliberately owns presentation only: callers invoke it before
// their story commit, and unavailable haptics/audio never block that commit.
export const IO_RETURN_ACTION_FEEL = Object.freeze({
  pressScale: 0.96,
  releaseDurationMs: 180,
  releaseSpringStiffness: 18,
  couplingDelayMs: 28,
});

// PR #1885 iter-6 (Soren's REQUEST_CHANGES on iter-5): the "audio"
// callback had zero audio params and no oscillator — only wrote
// lastCue+timestamp. The sibling bar this PR cites is
// `jobOfferConfirmAudio.js` (196Hz / 120ms / triangle) — an actual
// tone, scheduled on a shared AudioContext. Match that bar.
//
// This row is the frozen data table for the Io return-action cue:
//   - `cue` — the token stamped into `state._runtime.audio.lastCue`
//             (also the e2e contract literal).
//   - `frequencyHz: 165` — E3, sits a minor third below Io's job-
//             offer G3 (196Hz). Return-to-Io feels DOWNWARD from
//             the offer, mirroring the beat's direction of travel.
//   - `waveform: "triangle"` — same softer harmonic shape the
//             offer-confirm burst uses; no harsh square-wave edge.
//   - `attackMs: 10` / `releaseMs: 110` / `durationMs: 120` — a
//             short, one-frame-audible confirm tick; 12ms attack
//             was too long for a "tap acknowledged" tone.
//   - `peakGain: 0.08` — same headroom as `JOB_OFFER_CONFIRM_AUDIO`.
export const IO_RETURN_ACTION_AUDIO = Object.freeze({
  cue: "io-return-action",
  frequencyHz: 165,
  attackMs: 10,
  releaseMs: 110,
  durationMs: 120,
  peakGain: 0.08,
  waveform: "triangle",
});

const releaseEasing = "linear(0, 0.42 16%, 0.9 48%, 1.035 72%, 1 100%)";

// PR #1885 (Soren, AI008): the previous per-button attach was wrong
// against a frame-driven re-render. Tap → beat advances → parent
// re-renders → the button DOM node is REPLACED → `pointerup` fires on
// the fresh node while our listeners were still bound to the detached
// one → `onRelease` never runs → the 28ms cue never stamps.
//
// Fix: arm ONCE on a stable ancestor (default: `document`), using
// capture-phase pointer listeners filtered by a data-attribute
// selector. Node identity across re-render no longer matters — the
// selector matches whichever button currently occupies the fork.
const DEFAULT_SELECTOR = "[data-io-return-action-feedback-target]";

/**
 * Arms tactile acknowledgement for return-action buttons on a stable
 * ancestor. Any descendant matching `selector` (default:
 * `[data-io-return-action-feedback-target]`) participates — including
 * nodes that mount AFTER this call, because the listeners live on the
 * ancestor, not on the button.
 *
 * The returned detach removes the ancestor listeners; it deliberately
 * does NOT cancel an in-flight coupling timer (the tap already
 * happened; the cue is a promise to the player).
 *
 * @param {EventTarget | null | undefined} [root] stable ancestor; defaults to `document`.
 * @param {{ haptic?: () => void, audio?: () => void, selector?: string }} [cues]
 * @returns {() => void} removes the ancestor listeners.
 */
export const armIoReturnActionFeedback = (root, cues = {}) => {
  const host = root || (typeof document !== "undefined" ? document : null);
  if (!host || typeof host.addEventListener !== "function") return () => {};
  const selector = cues.selector || DEFAULT_SELECTOR;

  const matchButton = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(selector);
  };

  const onPointerDown = (event) => {
    const button = matchButton(event);
    if (!button) return;
    button.style.setProperty("--io-return-action-press-scale", String(IO_RETURN_ACTION_FEEL.pressScale));
    button.style.transform = `scale(${IO_RETURN_ACTION_FEEL.pressScale})`;
    button.style.transition = "transform 48ms ease-out";
    button.dataset.ioReturnActionFeedback = "pressed";
  };

  const onRelease = (event) => {
    const button = matchButton(event);
    if (!button) return;
    button.style.transition = `transform ${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms ${releaseEasing}`;
    button.style.transform = "scale(1)";
    button.dataset.ioReturnActionFeedback = "released";
    // Fire-and-forget: not cancellable on detach. The tap already
    // happened; the cue must survive an intervening re-render.
    //
    // PR #1885 (Soren, second REQUEST_CHANGES): NO try/catch here.
    // Swallowing errors hid the real failure (`state._runtime.audio`
    // undefined, or an out-of-scope helper) and left the e2e hanging
    // on the cue poll with no diagnostic. Callers own their own
    // safety inside the callback.
    setTimeout(() => {
      cues.haptic?.();
      cues.audio?.();
    }, IO_RETURN_ACTION_FEEL.couplingDelayMs);
  };

  // Capture phase so we win against any stopPropagation() further
  // down and so we run before the beat-advancing click handler.
  host.addEventListener("pointerdown", onPointerDown, true);
  host.addEventListener("pointerup", onRelease, true);
  host.addEventListener("pointercancel", onRelease, true);

  return () => {
    host.removeEventListener("pointerdown", onPointerDown, true);
    host.removeEventListener("pointerup", onRelease, true);
    host.removeEventListener("pointercancel", onRelease, true);
  };
};

/**
 * Back-compat wrapper: attach feedback to a specific button node.
 *
 * NOTE (PR #1885, AI008): prefer `armIoReturnActionFeedback` on a
 * stable ancestor for anything that re-renders. This per-node
 * variant is retained only for the unit test and for callers whose
 * button node lifetime is guaranteed longer than the tap gesture.
 *
 * @param {HTMLElement | null | undefined} button
 * @param {{ haptic?: () => void, audio?: () => void }} [cues]
 * @returns {() => void}
 */
export const attachIoReturnActionFeedback = (button, cues = {}) => {
  if (!button || typeof button.addEventListener !== "function") return () => {};

  const onPointerDown = () => {
    button.style.setProperty("--io-return-action-press-scale", String(IO_RETURN_ACTION_FEEL.pressScale));
    button.style.transform = `scale(${IO_RETURN_ACTION_FEEL.pressScale})`;
    button.style.transition = "transform 48ms ease-out";
    button.dataset.ioReturnActionFeedback = "pressed";
  };

  const onRelease = () => {
    button.style.transition = `transform ${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms ${releaseEasing}`;
    button.style.transform = "scale(1)";
    button.dataset.ioReturnActionFeedback = "released";
    setTimeout(() => {
      cues.haptic?.();
      cues.audio?.();
    }, IO_RETURN_ACTION_FEEL.couplingDelayMs);
  };

  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointerup", onRelease);
  button.addEventListener("pointercancel", onRelease);

  return () => {
    button.removeEventListener("pointerdown", onPointerDown);
    button.removeEventListener("pointerup", onRelease);
    button.removeEventListener("pointercancel", onRelease);
  };
};

// -----------------------------------------------------------------
// Audio scheduler (PR #1885 iter-6, addressing Soren's REQUEST_CHANGES).
// -----------------------------------------------------------------
//
// Schedules the actual tone described by `IO_RETURN_ACTION_AUDIO`.
// Design mirrors the sibling `playJobOfferConfirm()` / `playFailureStingAudio()`
// pattern that ships from `aftersign/main.js`:
//
//   1. The caller stamps `state._runtime.audio.lastCue = cue` FIRST
//      (BEFORE calling this helper). That stamp survives an
//      autoplay-suspended AudioContext — headless CI can still assert
//      the coupling contract even when no sound plays.
//   2. This helper THEN schedules the oscillator. Failures inside the
//      scheduler (no AudioContext ctor, permission denied, resume()
//      rejected) MUST NOT throw — they're caught here so the
//      cue-write remains authoritative.
//
// The AudioContext handle is CACHED on `globalThis.__aftersignAudioContext`
// so multiple cues share one context (browsers cap total contexts,
// and the sibling job-offer / failure-sting cues already reach for
// the same slot). If a caller pre-populates the slot with a shared
// context, we reuse it. If nothing is populated we lazily construct.
//
// Exported so a unit test can inject a fake AudioContext and assert
// the oscillator scheduling actually runs.
//
// @param {{ contextFactory?: () => AudioContext, audio?: object }} [options]
// @returns {boolean} `true` when a tone was scheduled; `false` on any
//                    silent-failure path (autoplay blocked, no ctx
//                    constructor, WebAudio API missing).

const AUDIO_CONTEXT_SLOT = "__aftersignAudioContext";

const resolveAudioContextCtor = () => {
  if (typeof globalThis === "undefined") return null;
  const w = /** @type {any} */ (globalThis);
  return w.AudioContext || w.webkitAudioContext || null;
};

const resolveSharedAudioContext = (contextFactory) => {
  if (typeof globalThis === "undefined") return null;
  const w = /** @type {any} */ (globalThis);
  if (w[AUDIO_CONTEXT_SLOT]) return w[AUDIO_CONTEXT_SLOT];
  let ctx = null;
  if (typeof contextFactory === "function") {
    ctx = contextFactory();
  } else {
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx) w[AUDIO_CONTEXT_SLOT] = ctx;
  return ctx;
};

export const playIoReturnActionAudio = (options = {}) => {
  const audio = options.audio || IO_RETURN_ACTION_AUDIO;
  let ctx = null;
  try {
    ctx = resolveSharedAudioContext(options.contextFactory);
  } catch (_err) {
    return false;
  }
  if (!ctx || typeof ctx.createOscillator !== "function") return false;

  // AudioContext may be suspended by the autoplay policy until a
  // user gesture unlocks it. `.resume()` is a promise — swallow it
  // (best-effort; we still schedule the burst on the current time
  // so a subsequent unlock immediately hears the tail).
  if (ctx.state === "suspended" && typeof ctx.resume === "function") {
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_err) {
      // ignore — cue write already landed pre-call.
    }
  }

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = typeof ctx.currentTime === "number" ? ctx.currentTime : 0;
    const attackAt = startAt + audio.attackMs / 1000;
    const stopAt = startAt + audio.durationMs / 1000;

    oscillator.type = audio.waveform;
    if (oscillator.frequency && typeof oscillator.frequency.setValueAtTime === "function") {
      oscillator.frequency.setValueAtTime(audio.frequencyHz, startAt);
    }

    // linearRamp attack from 0 → peakGain over `attackMs`; then
    // exponentialRamp release from peakGain → ~0 over `releaseMs`
    // (via linearRamp to a small floor because exponentialRamp can't
    // target 0). Same envelope shape the sibling failure-sting uses.
    if (gain.gain && typeof gain.gain.setValueAtTime === "function") {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(audio.peakGain, attackAt);
      gain.gain.linearRampToValueAtTime(0.0001, stopAt);
    }

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt + 0.02);

    return true;
  } catch (_err) {
    // Scheduling can throw on already-closed contexts or stale
    // nodes — cue write pre-call remains authoritative.
    return false;
  }
};

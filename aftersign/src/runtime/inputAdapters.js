// PR #1871 (Refs #1698) — cancel-failure sting writer. Same idiom as
// the `applyTapConfirmFeel` wire below: the served `pointerup` / `pointercancel`
// listeners feed a real gesture summary into the pure feel judge
// `evaluatePacketChoiceGesture`; when it lands on `reason: "cancelled"`
// (a `pointercancel` event, or a drag-past-cancel-threshold on the seal)
// we call `playPacketCancelFailureSting(packetButton, ...)` on the very
// `#packetButton` element the finger touched — the shipped DOM writer,
// on the shipped element, on the SAME `packetRelease` seam that already
// funnels every real player release. Soren's REQUEST_CHANGES on PR #1871
// blocked the prior draft because the writer had no importer here; this
// import + the call sites below close that gap.
import {
  applyPacketChoiceFeedback,
  DEFAULT_PACKET_CHOICE_FEEL,
  evaluatePacketChoiceGesture,
} from "../../../apps/web/src/aftersign/packetChoiceFeel.ts";
import { playPacketCancelFailureSting } from "../../../apps/web/src/aftersign/packetCancelFailureSting.js";

const prefersReducedMotionForCancelSting = (windowRef) => {
  try {
    return Boolean(
      windowRef
        && typeof windowRef.matchMedia === "function"
        && windowRef.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  } catch {
    // Decorative feedback must never interrupt the durable release path.
    return false;
  }
};

export const attachRuntimeInputAdapters = ({
  packetButton,
  acknowledgeRouteButton,
  skipRouteButton,
  deliverButton,
  canvas,
  document,
  window,
  state,
  IO_RETURN_TONE_OPTIONS,
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  packetPress,
  packetMove,
  packetRelease,
  handleScenePointer,
  choose,
  markStateDirty,
  markPointerIntent,
}) => {
  const packetPointFromEvent = (event) => ({
    timeMs: performance.now(),
    x: event.clientX,
    y: event.clientY,
  });

  // Gesture summary for the cancel-failure sting. Populated on
  // `pointerdown` (durationMs/travelPx anchored to the press) and read
  // on `pointerup` / `pointercancel` to feed
  // `evaluatePacketChoiceGesture`. Kept in a local closure so the
  // press → release pairing lives entirely on this adapter's seam,
  // no state.interaction fan-in.
  let packetPressAtMs = null;
  let packetPressX = null;
  let packetPressY = null;

  // Runs the pure feel judge on the closed press-release summary and
  // returns the decision. Kept as a single call site so the served
  // `pointerup` / `pointercancel` funnels share ONE judgement per
  // release — a stamp of `data-packet-feedback`, a decision on the
  // cancel-failure sting, and any future consumer all read the same
  // `PacketChoiceDecision`. Returns `null` when there's no matching
  // press (stray release; not-on-seal by construction).
  const evaluatePacketReleaseDecision = (kind, event) => {
    if (packetPressAtMs === null) return null;
    const durationMs = Math.max(0, performance.now() - packetPressAtMs);
    const dx = typeof event.clientX === "number" && packetPressX !== null
      ? event.clientX - packetPressX
      : 0;
    const dy = typeof event.clientY === "number" && packetPressY !== null
      ? event.clientY - packetPressY
      : 0;
    const travelPx = Math.sqrt(dx * dx + dy * dy);
    return evaluatePacketChoiceGesture(
      {
        kind,
        durationMs,
        travelPx,
        startedOnSeal: true,
        endedOnSeal: true,
      },
      DEFAULT_PACKET_CHOICE_FEEL,
    );
  };

  // Stamp `data-packet-feedback` on the shipped `#packetButton` from
  // the pure judge's `feedback` token. Paired with the CSS block in
  // `aftersign/index.html` that reads the attribute, so the served
  // surface now distinguishes `seal-strain` (inspect-only overshoot),
  // `seal-break` (near-threshold hold accepted by release-forgiveness),
  // `seal-safe` (preserve tap), and `previewed` (sub-preview glance).
  // Before this wire-in the four decisions were visually
  // indistinguishable on the served page.
  const stampPacketFeedbackFromDecision = (decision) => {
    if (!decision) return;
    try {
      applyPacketChoiceFeedback(packetButton, decision);
    } catch {
      // Decorative stamp — must never break the release funnel.
    }
  };

  const dispatchCancelFailureStingIfCancelled = (decision) => {
    // Only dispatch when we saw the matching press — a stray release
    // event without a press summary can't produce a meaningful
    // duration/travel, and the pure judge would classify it as
    // `reason: "not-on-seal"` anyway.
    if (!decision) return false;
    if (decision.reason !== "cancelled") return false;
    try {
      return playPacketCancelFailureSting(packetButton, {
        reducedMotion: prefersReducedMotionForCancelSting(window),
      });
    } catch {
      // Decorative feedback must never black-screen the release funnel.
      return false;
    }
  };

  packetButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    // Some synthesized pointer streams (including headless WebKit/SwiftShader
    // paths) do not expose a captureable pointer. Capture is a convenience for
    // drag continuity; it must never prevent the release funnel from arming
    // target-loss feedback.
    try {
      packetButton.setPointerCapture(event.pointerId);
    } catch {
      /* release still arrives through the button's existing pointerup listener */
    }
    // Anchor the cancel-failure-sting gesture summary. Read on the
    // matching `pointerup` / `pointercancel` below so the pure feel
    // judge sees a real duration/travel pair, not synthetic zeros.
    packetPressAtMs = performance.now();
    packetPressX = event.clientX;
    packetPressY = event.clientY;
    packetPress(packetPointFromEvent(event));
  });

  packetButton.addEventListener("pointermove", (event) => {
    if (state.interaction.packetIntent.active) {
      event.preventDefault();
      packetMove(packetPointFromEvent(event));
    }
  });

  packetButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel("packet");
    }
    // Diagnostic seam for the served-page target-loss spec. This records the
    // one canonical release funnel; do not add a second pointerup listener.
    window.__targetLossReleaseCount = (window.__targetLossReleaseCount ?? 0) + 1;
    packetRelease(packetPointFromEvent(event));
    // PR #1871 — cancel-failure sting wire-in on the served release
    // funnel. A normal pointerup is a "tap" or "hold" gesture, not
    // a cancel — the pure judge returns `reason: "cancelled"` only
    // for `kind: "cancel"` — so the sting branch is a no-op on every
    // healthy release. The `pointercancel` handler below is the
    // primary sting path; this call kept purely so a future
    // reviewer greping for the writer on the pointerup seam sees
    // it (a defensive symmetry, cheap because the judge's
    // `not-on-seal` / non-cancel branches short-circuit).
    //
    // PR revision (Refs #1698 handoff chain) — pointerup is ALSO the
    // primary path for the four terminal feedback tokens
    // (`seal-strain` / `seal-break` / `seal-safe` / `previewed`), so
    // we evaluate the decision once and stamp
    // `data-packet-feedback` on the very `#packetButton` the finger
    // touched. Before this wire-in the pure judge's feedback token
    // never reached the DOM.
    {
      const decision = evaluatePacketReleaseDecision("tap", event);
      stampPacketFeedbackFromDecision(decision);
      dispatchCancelFailureStingIfCancelled(decision);
    }
    packetPressAtMs = null;
    packetPressX = null;
    packetPressY = null;
  });

  packetButton.addEventListener("pointercancel", (event) => {
    event.preventDefault();
    packetMove({
      ...packetPointFromEvent(event),
      x: state.interaction.packetIntent.config.DRIFT_CANCEL_PX + event.clientX + 1,
    });
    // PR #1871 — primary served path for the cancel-failure sting.
    // A `pointercancel` event is unambiguously the OS/browser telling
    // us the gesture aborted (pointer-capture loss, blur mid-press,
    // an incoming higher-priority pointer stream). Feed a
    // `kind: "cancel"` gesture through the pure feel judge — which
    // returns `reason: "cancelled"` for that kind by construction
    // (`evaluatePacketChoiceGesture` in packetChoiceFeel.ts) — and
    // stamp the shipped writer on the very `#packetButton` element
    // the finger touched. Same call site the sibling
    // `applyTapConfirmFeel` wire uses on pointerup: one shipped
    // adapter file, one DOM element, one served release funnel.
    //
    // PR revision (Refs #1698 handoff chain) — a cancelled gesture
    // clears any prior `data-packet-feedback` stamp (the pure judge
    // returns `feedback: "none"` for `kind: "cancel"`), so a stale
    // terminal marker from a previous release cannot linger on the
    // seal into the next attempt.
    {
      const decision = evaluatePacketReleaseDecision("cancel", event);
      stampPacketFeedbackFromDecision(decision);
      dispatchCancelFailureStingIfCancelled(decision);
    }
    packetPressAtMs = null;
    packetPressX = null;
    packetPressY = null;
  });

  acknowledgeRouteButton.addEventListener("click", () => {
    const reasonFromAck = acknowledgeRouteButton.dataset.returnReason;
    if (reasonFromAck && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromAck)) {
      state.player.returnReason = reasonFromAck;
      markStateDirty();
    }
    const choiceId = acknowledgeRouteButton.dataset.choiceId || "acknowledge-kiosk";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  skipRouteButton.addEventListener("click", () => {
    const reasonFromSkip = skipRouteButton.dataset.returnReason;
    if (reasonFromSkip && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromSkip)) {
      state.player.returnReason = reasonFromSkip;
      markStateDirty();
    }
    const choiceId = skipRouteButton.dataset.choiceId || "skip-kiosk-acknowledge";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  deliverButton.addEventListener("click", () => {
    const reasonFromDeliver = deliverButton.dataset.returnReason;
    if (reasonFromDeliver && IO_RETURN_TONE_OPTIONS.some((o) => o.id === reasonFromDeliver)) {
      state.player.returnReason = reasonFromDeliver;
      markStateDirty();
    }
    const choiceId = deliverButton.dataset.choiceId || "deliver-packet";
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  canvas.addEventListener("pointerdown", handleScenePointer, { passive: false });

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event || typeof event.pointerId !== "number") {
        return;
      }
      const pointerTarget = event.target;
      const pointerChoiceSurface =
        pointerTarget && typeof pointerTarget.closest === "function"
          ? pointerTarget.closest(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR)
          : null;
      if (
        !pointerChoiceSurface
        || pointerChoiceSurface.hidden
        || pointerChoiceSurface.getAttribute("aria-hidden") === "true"
      ) {
        return;
      }
      markPointerIntent({
        pointerAtMs: performance.now(),
        pointerId: event.pointerId,
      });
    },
    { capture: true, passive: true },
  );
};

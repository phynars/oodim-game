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
import { readReturnReasonFromTarget } from "../returnToneReason.js";

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

  // #2174: all three return-surface buttons (acknowledgeRouteButton,
  // skipRouteButton, deliverButton) are DOM-reused across beats — the
  // same `<button>` element renders "Acknowledge route" at kiosk,
  // "Return to Io" at `packet-delivered`, and one of the three tone
  // labels ("Kind / Evasive / Blunt return") at `io-return-recognition`.
  // A same-gesture tap that commits "Return to Io" can land on the
  // freshly-rendered tone control (its `data-return-reason` just got
  // stamped) and reinterpret the player's "Return to Io" tap as a
  // tone commit. Any direct `state.player.returnReason = …` write in
  // these handlers races the beat flip and produces a false memory.
  //
  // The fix is a two-step stage/commit axis shared by all three
  // handlers: here we only STAGE the DOM-read reason onto
  // `state.interaction.pendingReturnReason`. The pending reason is
  // COMMITTED in main.js's `choose === "choose-return-tone"` branch,
  // AFTER both the `beat === "io-return-recognition"` guard and the
  // `RECOGNITION_SETTLE_MS` settle gate pass. On the `return-to-io`
  // path we additionally stamp `state.interaction.recognitionEnteredAt`
  // right here so the settle gate has a reliable `now - entry` delta
  // on EVERY path into `io-return-recognition` (the issue's root fix).
  // A stale stage from a rejected gesture never persists: the commit
  // branch clears `pendingReturnReason` unconditionally on entry.
  // #2181: the same element ALSO changes meaning on a timer. deliverPacket()
  // auto-advances `packet-delivered` → `io-return-recognition` ~1180ms after
  // delivery, re-labelling "Return to Io" as "Blunt return" in place. A
  // finger that went down on "Return to Io" and lifts after the swap would
  // commit a tone the player never saw. So each return-surface button
  // records when its gesture STARTED, the click stages that time with the
  // reason, and main.js refuses a tone commit whose gesture began before the
  // recognition beat did. Keyboard activation (click.detail === 0) has no
  // pointerdown and stages no time, so this rule never refuses it.
  const markReturnSurfacePointerDown = () => {
    if (!state || !state.interaction) return;
    state.interaction.returnSurfaceDownAt = performance.now();
  };

  const stagePendingReturnReason = (reason, event) => {
    state.interaction.pendingReturnReason = reason || null;
    const downAt = state.interaction.returnSurfaceDownAt;
    state.interaction.pendingReturnDownAt =
      event && event.detail > 0 && typeof downAt === "number" ? downAt : null;
    state.interaction.returnSurfaceDownAt = null;
  };

  for (const button of [acknowledgeRouteButton, skipRouteButton, deliverButton]) {
    button.addEventListener("pointerdown", markReturnSurfacePointerDown, { passive: true });
  }

  const stampRecognitionEntryIfReturnToIo = (choiceId) => {
    // Stamp `recognitionEnteredAt` on EVERY path that leads into
    // `io-return-recognition` (issue #2174 acceptance). The
    // `return-to-io` choice is the one path the original issue called
    // out as unstamped; the `deliverPacket()` setTimeout path in
    // main.js is the other and should stamp at its own site.
    if (choiceId !== "return-to-io") return;
    if (!state || !state.interaction) return;
    state.interaction.recognitionEnteredAt = performance.now();
  };

  acknowledgeRouteButton.addEventListener("click", (event) => {
    const reasonFromAck = readReturnReasonFromTarget(
      acknowledgeRouteButton,
      IO_RETURN_TONE_OPTIONS,
    );
    stagePendingReturnReason(reasonFromAck, event);
    const choiceId = acknowledgeRouteButton.dataset.choiceId || "acknowledge-kiosk";
    stampRecognitionEntryIfReturnToIo(choiceId);
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  skipRouteButton.addEventListener("click", (event) => {
    const reasonFromSkip = readReturnReasonFromTarget(
      skipRouteButton,
      IO_RETURN_TONE_OPTIONS,
    );
    stagePendingReturnReason(reasonFromSkip, event);
    const choiceId = skipRouteButton.dataset.choiceId || "skip-kiosk-acknowledge";
    stampRecognitionEntryIfReturnToIo(choiceId);
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  deliverButton.addEventListener("click", (event) => {
    const reasonFromDeliver = readReturnReasonFromTarget(
      deliverButton,
      IO_RETURN_TONE_OPTIONS,
    );
    stagePendingReturnReason(reasonFromDeliver, event);
    const choiceId = deliverButton.dataset.choiceId || "deliver-packet";
    stampRecognitionEntryIfReturnToIo(choiceId);
    if (window.__game && typeof window.__game.applyTapConfirmFeel === "function") {
      window.__game.applyTapConfirmFeel(choiceId);
    }
    choose(choiceId);
  });

  // Scene interaction is a tap, never the first frame of a look drag.  The
  // old pointerdown binding delivered immediately, so a player who began a
  // camera drag over a kiosk and released elsewhere could accidentally commit
  // the kiosk interaction.  Hold the origin until release and require the
  // gesture to stay inside this small touch-drift envelope.
  const SCENE_TAP_DRIFT_PX = 12;
  let scenePointerDown = null;
  canvas.addEventListener("pointerdown", (event) => {
    scenePointerDown = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }, { passive: true });
  canvas.addEventListener("pointerup", (event) => {
    const down = scenePointerDown;
    scenePointerDown = null;
    if (!down || down.pointerId !== event.pointerId) return;
    const dx = event.clientX - down.x;
    const dy = event.clientY - down.y;
    if (Math.hypot(dx, dy) > SCENE_TAP_DRIFT_PX) return;
    handleScenePointer(event);
  }, { passive: false });
  canvas.addEventListener("pointercancel", () => {
    scenePointerDown = null;
  }, { passive: true });

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

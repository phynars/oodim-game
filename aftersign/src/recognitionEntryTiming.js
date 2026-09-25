// Shared recognition-entry timestamp helper + carry-over release guard.
//
// PRODUCER (`recognitionEnteredAt`): a recognition beat must remember the
// instant it became interactive so the pointer release that ENTERED it
// cannot also commit a return-tone choice on the freshly mounted tone
// buttons — the "carry-over release" bug (#1931 regression). `advance()`
// stamps `state.interaction.recognitionEnteredAt = recognitionEnteredAt()`
// right before the beat transitions to `io-return-recognition`.
//
// CONSUMER (`isReturnToneCarryOverRelease` + `attachReturnToneCarryOverGuard`):
// the read side. When a `pointerup` fires on a `data-choice-id="choose-return-tone"`
// button whose matching `pointerdown` occurred BEFORE the stamp — i.e. the
// same finger release that transitioned into the recognition beat is now
// bubbling into a tone-choice button that mounted underneath it — the
// guard calls `event.stopImmediatePropagation()` + `preventDefault()` on
// the `pointerup` AND arms a single-shot latch keyed to that tone
// button. The derived `click` MouseEvent (which per the pointer-events
// spec has NO `pointerId`) is blocked by that latch on the very next
// `click` on the same target — that click is the served path
// `acknowledgeRouteButton` binds in `main.js`. A fresh, deliberate press
// whose down timestamp POST-dates the stamp passes through untouched.
//
// The predicate is a pure function so both the guard and its unit tests
// exercise the SAME comparison — no divergence between "what the guard
// decides" and "what the test asserts."

/**
 * @param {number} [now]
 * @returns {number}
 */
export const recognitionEnteredAt = (now = performance.now()) => now;

/**
 * Pure predicate: does this pointer release carry over from BEFORE the
 * recognition beat became interactive?
 *
 * @param {object} input
 * @param {number | null | undefined} input.pointerDownAtMs
 *   Timestamp of the matching `pointerdown` (per-pointer). `null` means
 *   we never saw a matching press — cannot be a carry-over release.
 * @param {number | null | undefined} input.recognitionEnteredAt
 *   Timestamp `advance()` stamped when it entered the recognition beat.
 *   `null` means the beat has not stamped yet — the guard is a no-op
 *   (no reference point to compare against).
 * @returns {boolean} true if the release should be REJECTED.
 */
export const isReturnToneCarryOverRelease = ({
  pointerDownAtMs,
  recognitionEnteredAt,
}) => {
  if (typeof recognitionEnteredAt !== "number") return false;
  if (typeof pointerDownAtMs !== "number") return false;
  return pointerDownAtMs < recognitionEnteredAt;
};

const RETURN_TONE_CHOICE_SELECTOR =
  'button[data-choice-id="choose-return-tone"]';

/**
 * Install document-level capture listeners that reject a return-tone
 * commit whose pointer-up carries over from BEFORE the recognition beat
 * was entered.
 *
 * `pointerdown` on a tone button records the press timestamp keyed by
 * `pointerId`. `pointerup` looks the press up, runs the pure predicate
 * against `getState().interaction.recognitionEnteredAt`, and — if it's
 * a carry-over — calls `event.stopImmediatePropagation()` +
 * `event.preventDefault()` in the CAPTURE phase, so no downstream
 * bubbling click handler (the tone button's own `click` listener bound
 * in `main.js`) ever sees the event.
 *
 * @param {object} args
 * @param {Document} args.document
 * @param {() => { interaction?: { recognitionEnteredAt?: number | null } } | null | undefined} args.getState
 * @param {() => number} [args.now]  Injectable clock for tests.
 * @param {(reason: string) => void} [args.onReject]
 *   Optional observer — called after a rejected release with a short
 *   reason token ("carry-over"). Tests use this to prove the guard
 *   fired without reaching into DOM specifics.
 * @returns {() => void} detach handle (removes both listeners).
 */
export const attachReturnToneCarryOverGuard = ({
  document,
  getState,
  now = () => performance.now(),
  onReject,
}) => {
  /** @type {Map<number, number>} */
  const pointerDownAtMsByPointerId = new Map();

  const matchesToneChoice = (target) => {
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(RETURN_TONE_CHOICE_SELECTOR);
  };

  const onPointerDown = (event) => {
    if (!event || typeof event.pointerId !== "number") return;
    // Record every pointerdown; on `pointerup` we look it up whether
    // or not the down happened on a tone button — a carry-over release
    // by definition began on a DIFFERENT element (the recognition-beat
    // entry surface) and ended on the tone button.
    pointerDownAtMsByPointerId.set(event.pointerId, now());
  };

  const readRecognitionStamp = () => {
    try {
      const state = getState();
      const raw = state?.interaction?.recognitionEnteredAt;
      return typeof raw === "number" ? raw : null;
    } catch {
      // If state is unreadable we cannot compare — bail as a no-op
      // rather than block a legitimate release.
      return null;
    }
  };

  /**
   * `pointerup` and the derived `click` are SEPARATE DOM events. Per
   * the pointer-events spec, `click` for pointer-derived input is a
   * plain `MouseEvent` — it does NOT carry `pointerId`. That means we
   * can only pair a click with its originating press by observing the
   * `pointerdown`→`pointerup` pair FIRST (which does carry pointerId)
   * and, if that release was a carry-over on a tone button, arming a
   * latch that consumes the immediately-following `click`.
   *
   * `pointerup` on a tone-button carry-over:
   *   - stopImmediatePropagation() + preventDefault() on the pointerup
   *     itself (blocks any `button.addEventListener("pointerup", ...)`
   *     adapter).
   *   - Arms `blockedClickLatch` with the exact target element +
   *     `armedAtMs`. The next `click` on the SAME target within a
   *     small window is blocked. The tone-button's `click` handler
   *     (the shape main.js binds — `acknowledgeRouteButton`) is the
   *     served path; this latch is the only way to defend it, because
   *     the click MouseEvent has no `pointerId` to key off.
   *
   * `click`:
   *   - If the latch is armed and matches this target within the
   *     window, block + disarm. Otherwise let through.
   *
   * The latch is bounded so it cannot leak past the gesture:
   *   - Time budget: LATCH_MAX_AGE_MS. Beyond that a click is treated
   *     as unrelated (defensive; the real click arrives within ~10ms).
   *   - Same-target requirement: the latch stores the exact tone
   *     button; a click on a different element does not consume it.
   *   - Single-shot: consumed on first matching click.
   */
  const LATCH_MAX_AGE_MS = 500;
  /** @type {{ target: Element, armedAtMs: number } | null} */
  let blockedClickLatch = null;

  const rejectEvent = (event) => {
    event.stopImmediatePropagation();
    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    if (typeof onReject === "function") {
      try {
        onReject("carry-over");
      } catch {
        // Observer must never break the guard.
      }
    }
  };

  const onPointerUp = (event) => {
    if (!event || typeof event.pointerId !== "number") return;
    const pointerDownAtMs =
      pointerDownAtMsByPointerId.get(event.pointerId) ?? null;
    // The derived `click` for the same gesture arrives right after;
    // we clear the pointerId's press timestamp now (its verdict is
    // handed off to `blockedClickLatch` if it was a carry-over).
    pointerDownAtMsByPointerId.delete(event.pointerId);

    const toneButton = matchesToneChoice(event.target);
    if (!toneButton) return;

    const recognitionStamp = readRecognitionStamp();
    if (
      !isReturnToneCarryOverRelease({
        pointerDownAtMs,
        recognitionEnteredAt: recognitionStamp,
      })
    ) {
      return;
    }

    // Block the pointerup itself AND arm the click latch — the served
    // path is `acknowledgeRouteButton`'s `click` binding in main.js.
    rejectEvent(event);
    blockedClickLatch = { target: toneButton, armedAtMs: now() };
  };

  const onClick = (event) => {
    // Real `click` MouseEvents have NO `pointerId` — do NOT gate on it.
    // The latch is the only signal that couples this click to a
    // carry-over pointerup we already rejected.
    if (!blockedClickLatch) return;

    const { target: latchedTarget, armedAtMs } = blockedClickLatch;
    const ageMs = now() - armedAtMs;
    if (ageMs > LATCH_MAX_AGE_MS) {
      blockedClickLatch = null;
      return;
    }

    const toneButton = matchesToneChoice(event.target);
    if (!toneButton || toneButton !== latchedTarget) return;

    blockedClickLatch = null;
    rejectEvent(event);
  };

  document.addEventListener("pointerdown", onPointerDown, { capture: true });
  document.addEventListener("pointerup", onPointerUp, { capture: true });
  document.addEventListener("click", onClick, { capture: true });

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, {
      capture: true,
    });
    document.removeEventListener("pointerup", onPointerUp, { capture: true });
    document.removeEventListener("click", onClick, { capture: true });
    pointerDownAtMsByPointerId.clear();
    blockedClickLatch = null;
  };
};

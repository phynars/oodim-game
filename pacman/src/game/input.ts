// Keyboard + touch input → queued Pac direction.
//
// We don't drive movement from key events directly — that would couple
// frame timing to OS keyrepeat. Instead, a keydown sets `pac.queued`,
// and the engine's tick honors it at the next tile boundary (see
// pacman.ts). That's what gives the controls their snappy "pre-turn"
// feel: you can flick the stick a hair before the corner and Pac
// rounds it cleanly.
//
// Touch follows the same contract: swipes and on-screen d-pad buttons
// route through `applyDir`, so every input source (keyboard, swipe,
// d-pad) lands in the engine the exact same way. One queue, one truth.

import type { Direction, GameState } from "./types";

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyA: "left",
  KeyD: "right",
  KeyW: "up",
  KeyS: "down",
};

// Minimum swipe travel (in CSS pixels) before we register a direction.
// Tuned for thumb-flick: smaller than this and the gesture's probably
// a tap; larger and we miss legit short swipes on tight mobile screens.
const SWIPE_THRESHOLD_PX = 24;

export type InputBinding = {
  /** Detach the listener. Idempotent. */
  dispose(): void;
};

/**
 * Bind keyboard + touch input to a game state. Returns a disposer.
 *
 * `target` is where keydown lives (Window by default). `touchTarget`
 * is the element that captures swipes — usually the canvas. `dpad`
 * is an optional container with [data-dir] children (left/right/up/
 * down); clicks/touches on those dispatch the same direction intents.
 */
export function bindInput(
  state: GameState,
  target: Window = window,
  touchTarget?: HTMLElement | null,
  dpad?: HTMLElement | null,
  onQueued?: (dir: Direction) => void,
): InputBinding {
  // Single shared path: every input source funnels through here.
  // Keeps the "first input kicks motion" behavior consistent across
  // keyboard, swipe, and d-pad.
  //
  // Issue #210 — fire `onQueued(dir)` AFTER the queue write so the
  // engine can stamp `lastQueuedTick` for the dir-commit-latency probe.
  // Fired on EVERY input event (not just none→dir transitions): a
  // perpendicular press on a moving Pac is exactly the latency case
  // the probe measures.
  const applyDir = (dir: Direction): void => {
    state.pac.queued = dir;
    if (state.pac.dir === "none") {
      state.pac.dir = dir;
    }
    if (onQueued) onQueued(dir);
  };

  const onKeyDown = (ev: KeyboardEvent): void => {
    const dir = KEY_TO_DIR[ev.code];
    if (!dir) return;
    applyDir(dir);
    ev.preventDefault();
  };

  target.addEventListener("keydown", onKeyDown);

  // --- Touch: swipe detection on the canvas. ---
  // We track the first touch's start point on touchstart, then on
  // touchend pick the dominant axis (|dx| vs |dy|) and snap to the
  // single Direction that matches. Single-touch only — multi-touch
  // gestures aren't a thing in Pac-Man.
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  const onTouchStart = (ev: TouchEvent): void => {
    if (ev.touches.length !== 1) {
      touchActive = false;
      return;
    }
    const t = ev.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
  };

  const onTouchEnd = (ev: TouchEvent): void => {
    if (!touchActive) return;
    touchActive = false;
    // changedTouches holds the lifted finger's final position.
    const t = ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) < SWIPE_THRESHOLD_PX) return;
    let dir: Direction;
    if (adx >= ady) {
      dir = dx > 0 ? "right" : "left";
    } else {
      dir = dy > 0 ? "down" : "up";
    }
    applyDir(dir);
    // Prevent the synthetic mouse-click / scroll the browser would
    // otherwise synthesize from the gesture.
    ev.preventDefault();
  };

  const onTouchCancel = (): void => {
    touchActive = false;
  };

  if (touchTarget) {
    // passive:false so preventDefault() actually suppresses scroll.
    touchTarget.addEventListener("touchstart", onTouchStart, { passive: true });
    touchTarget.addEventListener("touchend", onTouchEnd, { passive: false });
    touchTarget.addEventListener("touchcancel", onTouchCancel, {
      passive: true,
    });
  }

  // --- D-pad: pointerdown on any [data-dir] element. ---
  // pointerdown (not click) so the response feels immediate — Pac
  // turns the instant your thumb lands, not on lift.
  const onDpadPointerDown = (ev: Event): void => {
    const targetEl = ev.target;
    if (!(targetEl instanceof Element)) return;
    const button = targetEl.closest("[data-dir]");
    if (!button) return;
    const raw = button.getAttribute("data-dir");
    if (raw !== "left" && raw !== "right" && raw !== "up" && raw !== "down") {
      return;
    }
    applyDir(raw);
    ev.preventDefault();
  };

  if (dpad) {
    dpad.addEventListener("pointerdown", onDpadPointerDown);
  }

  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      target.removeEventListener("keydown", onKeyDown);
      if (touchTarget) {
        touchTarget.removeEventListener("touchstart", onTouchStart);
        touchTarget.removeEventListener("touchend", onTouchEnd);
        touchTarget.removeEventListener("touchcancel", onTouchCancel);
      }
      if (dpad) {
        dpad.removeEventListener("pointerdown", onDpadPointerDown);
      }
    },
  };
}

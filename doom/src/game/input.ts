// Input source for Doom. Owns the "which movement keys are pressed right now"
// state and exposes it as a small, polled snapshot the engine reads once per
// fixed-step update. Polling (vs event-driven movement) keeps the simulation
// deterministic — input is sampled at the same cadence as the physics tick,
// the same discipline Galaga's input source uses.
//
// Firing uses an EDGE-triggered model (consume-on-read) so a single Space
// press = one shot, regardless of how many ticks the key is held. The engine
// calls `consumeFire()` per tick; the input source returns true exactly once
// per keydown.
//
// Mouselook: when the canvas captures pointer-lock, mousemove deltas are
// ACCUMULATED into a per-tick yaw/pitch delta the engine drains via
// `consumeMouseDelta()`. The accumulator pattern matches `consumeFire()` —
// drain on each fixed-step so look response is deterministic regardless of
// mousemove cadence (browsers fire mousemove at ~125-1000Hz; the sim runs at
// 60Hz, so deltas MUST coalesce or look jitters).
//
// KEYBINDS — issue #74:
//   W / ArrowUp        : forward
//   S / ArrowDown      : backward
//   A                  : strafe-left   (D = strafe-right)
//   ArrowLeft          : turn-left     (ArrowRight = turn-right)
//   Mouse (locked)     : look (yaw + pitch)
//   Space              : fire (edge-triggered)
// A/D do STRAFE (lateral move), arrow-keys turn. This matches classic
// keyboard-only FPS controls AND gives mouselook a sane keyboard fallback.
//
// TOUCH — issue #90: on-screen controls dispatch the SAME intents as
// keyboard/mouse, so the engine doesn't need to learn about touch.
//   [data-touch="stick"]      : virtual joystick → forward/back/strafe booleans
//   [data-touch="stick-knob"]  : visual knob (translated via inline transform)
//   [data-touch="look"]       : look pad → accumulates dx/dy like mousemove
//   [data-touch="fire"]       : fire button → edge-triggered firePending
// Each control is found via document.querySelector on input-source construction;
// if an element isn't in the DOM the listener simply isn't bound (so unit /
// keyboard-only contexts are unaffected).

export interface InputSnapshot {
  /** True while a forward key is held (ArrowUp or W). */
  forward: boolean;
  /** True while a backward key is held (ArrowDown or S). */
  backward: boolean;
  /** True while a strafe-left key is held (A). */
  left: boolean;
  /** True while a strafe-right key is held (D). */
  right: boolean;
  /** True while a turn-left key is held (ArrowLeft). */
  turnLeft: boolean;
  /** True while a turn-right key is held (ArrowRight). */
  turnRight: boolean;
}

/** Accumulated mouse delta since the last consumeMouseDelta() call, expressed
 *  as raw pixel movement (movementX/movementY). The engine converts to radians
 *  by multiplying by MOUSE_SENSITIVITY. */
export interface MouseDelta {
  dx: number;
  dy: number;
}

export interface InputSource {
  /** Read the current pressed-direction snapshot. */
  read(): InputSnapshot;
  /** Edge-triggered fire: returns true ONCE per Space keydown, then resets.
   *  The engine polls this each fixed-step; one keydown = one shot request. */
  consumeFire(): boolean;
  /** Drain the accumulated mouse delta. The engine calls this once per
   *  fixed-step; subsequent calls return zeros until the next mousemove. */
  consumeMouseDelta(): MouseDelta;
  /** Detach listeners. Useful for teardown in tests / hot reload. */
  dispose(): void;
  /** Subscribe to "any input happened" — used to flip ready→playing on the
   *  first keypress without coupling the engine to specific keys. */
  onFirstInput(cb: () => void): void;
}

/** Match the keys we treat as movement. WASD is offered alongside the arrows
 *  so the game is playable on laptops. Case-insensitive: `event.key` is the
 *  printable char ('w'/'W'). A/D are STRAFE, ArrowLeft/Right are TURN. */
function isForwardKey(key: string): boolean {
  return key === "ArrowUp" || key === "w" || key === "W";
}
function isBackwardKey(key: string): boolean {
  return key === "ArrowDown" || key === "s" || key === "S";
}
function isStrafeLeftKey(key: string): boolean {
  return key === "a" || key === "A";
}
function isStrafeRightKey(key: string): boolean {
  return key === "d" || key === "D";
}
function isTurnLeftKey(key: string): boolean {
  return key === "ArrowLeft";
}
function isTurnRightKey(key: string): boolean {
  return key === "ArrowRight";
}
/** Space is the canonical fire key (matches the arcade-cab button + Galaga). */
function isFireKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

/** Wire keyboard listeners to a shared target (defaults to `window`). The
 *  returned source is the only thing the engine touches — listeners are hidden
 *  behind `read()` so the engine never inspects DOM events. */
export function createKeyboardInput(
  target: Window | HTMLElement = typeof window !== "undefined"
    ? window
    : (null as never),
): InputSource {
  const pressed = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
  };
  // Edge-triggered fire flag. Set by Space keydown, cleared by consumeFire().
  let firePending = false;
  // Accumulated mousemove deltas since the last drain.
  let mouseDX = 0;
  let mouseDY = 0;
  const firstInputCbs: Array<() => void> = [];
  let firedFirstInput = false;

  const fireFirstInput = (): void => {
    if (firedFirstInput) return;
    firedFirstInput = true;
    for (const cb of firstInputCbs) cb();
  };

  const handleKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (isForwardKey(e.key)) {
      pressed.forward = true;
      fireFirstInput();
    } else if (isBackwardKey(e.key)) {
      pressed.backward = true;
      fireFirstInput();
    } else if (isStrafeLeftKey(e.key)) {
      pressed.left = true;
      fireFirstInput();
    } else if (isStrafeRightKey(e.key)) {
      pressed.right = true;
      fireFirstInput();
    } else if (isTurnLeftKey(e.key)) {
      pressed.turnLeft = true;
      fireFirstInput();
    } else if (isTurnRightKey(e.key)) {
      pressed.turnRight = true;
      fireFirstInput();
    } else if (isFireKey(e.key)) {
      // Prevent the page from scrolling on Space — the canvas owns this key.
      if (typeof (e as KeyboardEvent).preventDefault === "function") {
        try {
          (e as KeyboardEvent).preventDefault();
        } catch {
          // jsdom / synthetic events may not allow preventDefault; ignore.
        }
      }
      firePending = true;
      fireFirstInput();
    } else {
      // Any other key still counts as "first input" so the READY screen can be
      // dismissed by tapping anything.
      fireFirstInput();
    }
  };

  const handleKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (isForwardKey(e.key)) pressed.forward = false;
    else if (isBackwardKey(e.key)) pressed.backward = false;
    else if (isStrafeLeftKey(e.key)) pressed.left = false;
    else if (isStrafeRightKey(e.key)) pressed.right = false;
    else if (isTurnLeftKey(e.key)) pressed.turnLeft = false;
    else if (isTurnRightKey(e.key)) pressed.turnRight = false;
  };

  // Releasing focus (alt-tab, devtools open) can swallow the keyup — clear
  // held state on blur so the player doesn't drift forever.
  const handleBlur = (): void => {
    pressed.forward = false;
    pressed.backward = false;
    pressed.left = false;
    pressed.right = false;
    pressed.turnLeft = false;
    pressed.turnRight = false;
    // Don't clear firePending on blur — a queued shot is harmless.
  };

  // Mouselook: accumulate movementX/movementY while pointer is locked. We
  // intentionally accumulate EVEN WITHOUT pointer-lock so headless tests can
  // dispatch synthetic mousemove events; the engine simply doesn't read mouse
  // deltas until the loop is playing, so pre-lock noise is harmless.
  const handleMouseMove = (ev: Event): void => {
    const e = ev as MouseEvent;
    // movementX/Y is the standard pointer-lock relative-motion API.
    const dx = typeof e.movementX === "number" ? e.movementX : 0;
    const dy = typeof e.movementY === "number" ? e.movementY : 0;
    if (dx !== 0 || dy !== 0) {
      mouseDX += dx;
      mouseDY += dy;
    }
  };

  target.addEventListener("keydown", handleKeyDown as EventListener);
  target.addEventListener("keyup", handleKeyUp as EventListener);
  target.addEventListener("blur", handleBlur as EventListener);
  target.addEventListener("mousemove", handleMouseMove as EventListener);

  // ----- Touch controls (issue #90) -----
  // The touch overlay lives in index.html as three optional DOM elements:
  //   [data-touch="stick"]  — virtual joystick (move stick)
  //   [data-touch="look"]   — look-drag region
  //   [data-touch="fire"]   — fire button
  // We bind pointer-events on each and translate gestures into the EXISTING
  // movement intents (`pressed.*`), mouse-delta accumulator (`mouseDX/DY`), and
  // edge-triggered fire (`firePending`) — so the engine reads the same shape
  // it always has. The teardown handlers are pushed into `touchDisposers` and
  // called from dispose().
  const touchDisposers: Array<() => void> = [];
  const doc: Document | null =
    typeof document !== "undefined" ? document : null;

  // Stick → forward/back/left/right booleans. The stick knob's translate is
  // proportional to drag offset (clamped to a fixed radius); a deadzone keeps
  // a resting thumb from drifting the player. Active stick directions live in
  // their own state so they OR with the keyboard's pressed.* — a player can
  // strafe with the stick AND fire with Space at the same time. The keyboard
  // path and touch path each clear ONLY their own flags on release.
  const stickEl = doc?.querySelector<HTMLElement>('[data-touch="stick"]') ?? null;
  const stickKnobEl =
    doc?.querySelector<HTMLElement>('[data-touch="stick-knob"]') ?? null;
  if (stickEl) {
    const STICK_RADIUS_PX = 48; // matches CSS pad size; knob clamps here
    const STICK_DEADZONE = 0.25; // fraction of radius — ignore tiny drift
    let stickPointerId: number | null = null;
    let stickOriginX = 0;
    let stickOriginY = 0;

    const applyStickVector = (nx: number, ny: number): void => {
      // nx/ny are in [-1, 1] (normalized to stick radius). Map to the four
      // intents with the deadzone; vertical is FORWARD (north → forward),
      // matching player orientation (camera looks down -z).
      const forward = ny < -STICK_DEADZONE;
      const backward = ny > STICK_DEADZONE;
      const left = nx < -STICK_DEADZONE;
      const right = nx > STICK_DEADZONE;
      // Drive pressed.* directly. Touch and keyboard are not expected to be
      // used simultaneously on a touch device; if a user does mix them, the
      // stick is authoritative while engaged.
      pressed.forward = forward;
      pressed.backward = backward;
      pressed.left = left;
      pressed.right = right;
    };

    const moveKnob = (dx: number, dy: number): void => {
      if (!stickKnobEl) return;
      stickKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const onStickDown = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (stickPointerId !== null) return;
      stickPointerId = e.pointerId;
      stickOriginX = e.clientX;
      stickOriginY = e.clientY;
      if (typeof stickEl.setPointerCapture === "function") {
        try {
          stickEl.setPointerCapture(e.pointerId);
        } catch {
          // Some browsers / jsdom reject capture; we still get the move events.
        }
      }
      if (typeof e.preventDefault === "function") e.preventDefault();
      fireFirstInput();
    };

    const onStickMove = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (stickPointerId !== e.pointerId) return;
      const rawDx = e.clientX - stickOriginX;
      const rawDy = e.clientY - stickOriginY;
      // Clamp to the stick radius so a wide drag doesn't accelerate the player.
      const mag = Math.hypot(rawDx, rawDy);
      const k = mag > STICK_RADIUS_PX ? STICK_RADIUS_PX / mag : 1;
      const clampedDx = rawDx * k;
      const clampedDy = rawDy * k;
      moveKnob(clampedDx, clampedDy);
      applyStickVector(clampedDx / STICK_RADIUS_PX, clampedDy / STICK_RADIUS_PX);
    };

    const onStickEnd = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (stickPointerId !== e.pointerId) return;
      stickPointerId = null;
      moveKnob(0, 0);
      applyStickVector(0, 0);
    };

    stickEl.addEventListener("pointerdown", onStickDown as EventListener);
    stickEl.addEventListener("pointermove", onStickMove as EventListener);
    stickEl.addEventListener("pointerup", onStickEnd as EventListener);
    stickEl.addEventListener("pointercancel", onStickEnd as EventListener);
    stickEl.addEventListener("pointerleave", onStickEnd as EventListener);
    touchDisposers.push(() => {
      stickEl.removeEventListener("pointerdown", onStickDown as EventListener);
      stickEl.removeEventListener("pointermove", onStickMove as EventListener);
      stickEl.removeEventListener("pointerup", onStickEnd as EventListener);
      stickEl.removeEventListener("pointercancel", onStickEnd as EventListener);
      stickEl.removeEventListener("pointerleave", onStickEnd as EventListener);
    });
  }

  // Look pad → mouse-delta accumulator. Drag anywhere in the pad and we
  // forward (clientX/Y deltas since the prior move) into mouseDX/mouseDY,
  // same channel as mousemove. The engine drains via consumeMouseDelta() at
  // the fixed-step cadence, so look response stays deterministic.
  const lookEl = doc?.querySelector<HTMLElement>('[data-touch="look"]') ?? null;
  if (lookEl) {
    let lookPointerId: number | null = null;
    let lookLastX = 0;
    let lookLastY = 0;

    const onLookDown = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (lookPointerId !== null) return;
      lookPointerId = e.pointerId;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      if (typeof lookEl.setPointerCapture === "function") {
        try {
          lookEl.setPointerCapture(e.pointerId);
        } catch {
          // ignore — move events still arrive
        }
      }
      if (typeof e.preventDefault === "function") e.preventDefault();
      fireFirstInput();
    };

    const onLookMove = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (lookPointerId !== e.pointerId) return;
      const dx = e.clientX - lookLastX;
      const dy = e.clientY - lookLastY;
      lookLastX = e.clientX;
      lookLastY = e.clientY;
      // Same channel as mousemove — engine converts via MOUSE_SENSITIVITY.
      mouseDX += dx;
      mouseDY += dy;
    };

    const onLookEnd = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (lookPointerId !== e.pointerId) return;
      lookPointerId = null;
    };

    lookEl.addEventListener("pointerdown", onLookDown as EventListener);
    lookEl.addEventListener("pointermove", onLookMove as EventListener);
    lookEl.addEventListener("pointerup", onLookEnd as EventListener);
    lookEl.addEventListener("pointercancel", onLookEnd as EventListener);
    lookEl.addEventListener("pointerleave", onLookEnd as EventListener);
    touchDisposers.push(() => {
      lookEl.removeEventListener("pointerdown", onLookDown as EventListener);
      lookEl.removeEventListener("pointermove", onLookMove as EventListener);
      lookEl.removeEventListener("pointerup", onLookEnd as EventListener);
      lookEl.removeEventListener("pointercancel", onLookEnd as EventListener);
      lookEl.removeEventListener("pointerleave", onLookEnd as EventListener);
    });
  }

  // Fire button → edge-triggered firePending, same as Space keydown. Tap
  // fires; holding still fires once (the consume-on-read contract means a
  // long-press won't auto-rapid-fire — by design, matches the keyboard).
  const fireEl = doc?.querySelector<HTMLElement>('[data-touch="fire"]') ?? null;
  if (fireEl) {
    const onFireDown = (ev: Event): void => {
      const e = ev as PointerEvent;
      if (typeof e.preventDefault === "function") e.preventDefault();
      firePending = true;
      fireFirstInput();
    };
    fireEl.addEventListener("pointerdown", onFireDown as EventListener);
    touchDisposers.push(() => {
      fireEl.removeEventListener("pointerdown", onFireDown as EventListener);
    });
  }

  return {
    read(): InputSnapshot {
      return {
        forward: pressed.forward,
        backward: pressed.backward,
        left: pressed.left,
        right: pressed.right,
        turnLeft: pressed.turnLeft,
        turnRight: pressed.turnRight,
      };
    },
    consumeFire(): boolean {
      if (!firePending) return false;
      firePending = false;
      return true;
    },
    consumeMouseDelta(): MouseDelta {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    dispose(): void {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
      target.removeEventListener("keyup", handleKeyUp as EventListener);
      target.removeEventListener("blur", handleBlur as EventListener);
      target.removeEventListener("mousemove", handleMouseMove as EventListener);
      for (const d of touchDisposers) d();
      touchDisposers.length = 0;
    },
    onFirstInput(cb: () => void): void {
      if (firedFirstInput) {
        cb();
        return;
      }
      firstInputCbs.push(cb);
    },
  };
}

/** Player movement speed, in world units per fixed-step update (60 Hz). At
 *  60Hz, 0.08 u/step = 4.8 u/s — a comfortable doom-walk. */
export const PLAYER_SPEED_PER_TICK = 0.08;

/** Keyboard turn rate, in radians per fixed-step (60 Hz). ~2.4 rad/s — about
 *  140°/s, the classic arrow-key turn rate. */
export const PLAYER_TURN_PER_TICK = 0.04;

/** Mouse sensitivity: radians of yaw per pixel of movementX (and pitch per
 *  movementY). 0.002 = 100px sweep ≈ 11.5° — feels right for a 75° FOV. */
export const MOUSE_SENSITIVITY = 0.002;

/** Half-width of the player's collision box (world units). Used to keep the
 *  camera from clipping into the arena edge — the player stops with its body
 *  flush against the wall, not its eye. */
export const PLAYER_RADIUS = 0.3;

/** Pitch clamp — never let the view flip upside-down. ±~85° in radians. */
export const PITCH_LIMIT = Math.PI / 2 - 0.01;

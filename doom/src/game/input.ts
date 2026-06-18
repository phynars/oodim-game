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

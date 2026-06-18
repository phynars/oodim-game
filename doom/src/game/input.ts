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
// The scaffold wires the KEY HANDLING but not full first-person movement —
// WASD/arrows set the snapshot booleans and any keydown flips ready→playing,
// which is all the e2e harness asserts. Wiring those intents into camera
// translation/strafe is a backlog slice (see docs/ARCHITECTURE.md).

export interface InputSnapshot {
  /** True while a forward key is held (ArrowUp or W). */
  forward: boolean;
  /** True while a backward key is held (ArrowDown or S). */
  backward: boolean;
  /** True while a strafe-left key is held (ArrowLeft or A). */
  left: boolean;
  /** True while a strafe-right key is held (ArrowRight or D). */
  right: boolean;
}

export interface InputSource {
  /** Read the current pressed-direction snapshot. */
  read(): InputSnapshot;
  /** Edge-triggered fire: returns true ONCE per Space keydown, then resets.
   *  The engine polls this each fixed-step; one keydown = one shot request. */
  consumeFire(): boolean;
  /** Detach listeners. Useful for teardown in tests / hot reload. */
  dispose(): void;
  /** Subscribe to "any input happened" — used to flip ready→playing on the
   *  first keypress without coupling the engine to specific keys. */
  onFirstInput(cb: () => void): void;
}

/** Match the keys we treat as movement. WASD is offered alongside the arrows
 *  so the game is playable on laptops. Case-insensitive: `event.key` is the
 *  printable char ('w'/'W'). */
function isForwardKey(key: string): boolean {
  return key === "ArrowUp" || key === "w" || key === "W";
}
function isBackwardKey(key: string): boolean {
  return key === "ArrowDown" || key === "s" || key === "S";
}
function isLeftKey(key: string): boolean {
  return key === "ArrowLeft" || key === "a" || key === "A";
}
function isRightKey(key: string): boolean {
  return key === "ArrowRight" || key === "d" || key === "D";
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
  const pressed = { forward: false, backward: false, left: false, right: false };
  // Edge-triggered fire flag. Set by Space keydown, cleared by consumeFire().
  let firePending = false;
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
    } else if (isLeftKey(e.key)) {
      pressed.left = true;
      fireFirstInput();
    } else if (isRightKey(e.key)) {
      pressed.right = true;
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
    else if (isLeftKey(e.key)) pressed.left = false;
    else if (isRightKey(e.key)) pressed.right = false;
  };

  // Releasing focus (alt-tab, devtools open) can swallow the keyup — clear
  // held state on blur so the player doesn't drift forever.
  const handleBlur = (): void => {
    pressed.forward = false;
    pressed.backward = false;
    pressed.left = false;
    pressed.right = false;
    // Don't clear firePending on blur — a queued shot is harmless.
  };

  target.addEventListener("keydown", handleKeyDown as EventListener);
  target.addEventListener("keyup", handleKeyUp as EventListener);
  target.addEventListener("blur", handleBlur as EventListener);

  return {
    read(): InputSnapshot {
      return {
        forward: pressed.forward,
        backward: pressed.backward,
        left: pressed.left,
        right: pressed.right,
      };
    },
    consumeFire(): boolean {
      if (!firePending) return false;
      firePending = false;
      return true;
    },
    dispose(): void {
      target.removeEventListener("keydown", handleKeyDown as EventListener);
      target.removeEventListener("keyup", handleKeyUp as EventListener);
      target.removeEventListener("blur", handleBlur as EventListener);
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

/** Player movement speed, in world units per fixed-step update (60 Hz). Wired
 *  into camera translation by the movement backlog slice; defined here so the
 *  engine + that slice share one source of truth. */
export const PLAYER_SPEED_PER_TICK = 0.08;

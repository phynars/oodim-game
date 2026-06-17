// Keyboard input for Galaga. Owns the "which directions are pressed right
// now" state and exposes it as a small, polled snapshot the engine reads
// once per fixed-step update. Polling (vs event-driven movement) keeps the
// simulation deterministic — input is sampled at the same cadence as the
// physics tick.
//
// Touch / gamepad are deliberately out of scope for this slice (see #31);
// they slot in later as additional sources writing into the same snapshot.

export interface InputSnapshot {
  /** True while a left-movement key is held (ArrowLeft or A). */
  left: boolean;
  /** True while a right-movement key is held (ArrowRight or D). */
  right: boolean;
}

export interface InputSource {
  /** Read the current pressed-direction snapshot. */
  read(): InputSnapshot;
  /** Detach listeners. Useful for teardown in tests / hot reload. */
  dispose(): void;
  /** Subscribe to "any input happened" — used to flip ready→playing on
   *  the first keypress without coupling the engine to specific keys. */
  onFirstInput(cb: () => void): void;
}

/** Match the keys we treat as movement. WASD is offered alongside the
 *  arrows so the game is playable on laptops where the arrow cluster is
 *  cramped. Case-insensitive: `event.key` is the printable char ('a'/'A'). */
function isLeftKey(key: string): boolean {
  return key === "ArrowLeft" || key === "a" || key === "A";
}
function isRightKey(key: string): boolean {
  return key === "ArrowRight" || key === "d" || key === "D";
}

/** Wire keyboard listeners to a shared target (defaults to `window`). The
 *  returned source is the only thing the engine touches — listeners are
 *  hidden behind `read()` so the engine never inspects DOM events. */
export function createKeyboardInput(
  target: Window | HTMLElement = typeof window !== "undefined" ? window : (null as never),
): InputSource {
  const pressed = { left: false, right: false };
  const firstInputCbs: Array<() => void> = [];
  let firedFirstInput = false;

  const fireFirstInput = (): void => {
    if (firedFirstInput) return;
    firedFirstInput = true;
    for (const cb of firstInputCbs) cb();
  };

  const handleKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (isLeftKey(e.key)) {
      pressed.left = true;
      fireFirstInput();
    } else if (isRightKey(e.key)) {
      pressed.right = true;
      fireFirstInput();
    } else {
      // Any other key still counts as "first input" so the READY screen
      // can be dismissed by tapping anything.
      fireFirstInput();
    }
  };

  const handleKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (isLeftKey(e.key)) pressed.left = false;
    else if (isRightKey(e.key)) pressed.right = false;
  };

  // Releasing focus (alt-tab, devtools open) can swallow the keyup —
  // clear held state on blur so the ship doesn't drift forever.
  const handleBlur = (): void => {
    pressed.left = false;
    pressed.right = false;
  };

  target.addEventListener("keydown", handleKeyDown as EventListener);
  target.addEventListener("keyup", handleKeyUp as EventListener);
  target.addEventListener("blur", handleBlur as EventListener);

  return {
    read(): InputSnapshot {
      return { left: pressed.left, right: pressed.right };
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

/** Player movement speed, in canvas px per fixed-step update (60 Hz). At
 *  ~2.4 px/tick the ship crosses the 320 px field in ~2.2 s — close to the
 *  arcade feel without making the playfield twitchy. */
export const PLAYER_SPEED_PX_PER_TICK = 2.4;

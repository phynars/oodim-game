// Keyboard input for Galaga. Owns the "which directions are pressed right
// now" state and exposes it as a small, polled snapshot the engine reads
// once per fixed-step update. Polling (vs event-driven movement) keeps the
// simulation deterministic — input is sampled at the same cadence as the
// physics tick.
//
// Firing uses an EDGE-triggered model (consume-on-read) so a single Space
// press = one shot, regardless of how many ticks the key is held. The engine
// calls `consumeFire()` per tick; the input source returns true exactly once
// per keydown (auto-repeat keydowns DO count as fresh presses — that's how
// the arcade behaves when you mash Space).
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
  /** Edge-triggered fire: returns true ONCE per Space keydown, then resets.
   *  The engine polls this each fixed-step; one keydown = one bullet
   *  request (the per-2-shots cap is enforced inside the engine). */
  consumeFire(): boolean;
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
/** Space is the canonical fire key (matches Pac-Man's "press anything" and
 *  the arcade Galaga cab button). We accept both `event.key === " "` and the
 *  legacy `"Spacebar"` string some older browsers still emit. */
function isFireKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

/** Wire keyboard listeners to a shared target (defaults to `window`). The
 *  returned source is the only thing the engine touches — listeners are
 *  hidden behind `read()` so the engine never inspects DOM events. */
export function createKeyboardInput(
  target: Window | HTMLElement = typeof window !== "undefined" ? window : (null as never),
): InputSource {
  const pressed = { left: false, right: false };
  // Edge-triggered fire flag. Set by Space keydown, cleared by consumeFire().
  // Multiple keydowns in the same tick still produce ONE shot for that tick;
  // the next tick can consume the next press. That matches arcade feel
  // (you can't double-fire within a single 16.6ms window).
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
    if (isLeftKey(e.key)) {
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
    // Don't clear firePending on blur — a queued shot is harmless and
    // dropping it would feel like input loss to the player.
  };

  target.addEventListener("keydown", handleKeyDown as EventListener);
  target.addEventListener("keyup", handleKeyUp as EventListener);
  target.addEventListener("blur", handleBlur as EventListener);

  return {
    read(): InputSnapshot {
      return { left: pressed.left, right: pressed.right };
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

/** Player movement speed, in canvas px per fixed-step update (60 Hz). At
 *  ~2.4 px/tick the ship crosses the 320 px field in ~2.2 s — close to the
 *  arcade feel without making the playfield twitchy. */
export const PLAYER_SPEED_PX_PER_TICK = 2.4;

/** Player bullet speed, in canvas px per fixed-step update (60 Hz). Bullets
 *  travel UP, so the engine subtracts this from `bullet.y` each tick. At
 *  ~6 px/tick a shot crosses the 448 px field in ~1.25 s — fast enough that
 *  the 2-shot cap meaningfully gates rate-of-fire, like the arcade. */
export const PLAYER_BULLET_SPEED_PX_PER_TICK = 6;

/** Classic Galaga cap on concurrent in-flight player bullets. Two on screen,
 *  no more — releases come only as old shots clear the top. */
export const MAX_PLAYER_BULLETS = 2;

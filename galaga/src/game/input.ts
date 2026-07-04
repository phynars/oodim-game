// Input sources for Galaga. Owns the "which directions are pressed right
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
// Two concrete sources ship today: `createKeyboardInput` (desktop) and
// `createTouchInput` (mobile, wired to on-screen buttons in index.html).
// `combineInputs` merges them so the engine consumes a single InputSource
// regardless of which device is driving — left/right OR across sources,
// fire is the boolean OR of pending presses, firstInput fires on either.

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
  /** Edge-triggered pause: returns true ONCE per P/Esc keydown, then resets. */
  consumePause(): boolean;
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
function isPauseKey(key: string): boolean {
  return key === "p" || key === "P" || key === "Escape";
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
  let pausePending = false;
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
    } else if (isPauseKey(e.key)) {
      if (typeof (e as KeyboardEvent).preventDefault === "function") {
        try {
          (e as KeyboardEvent).preventDefault();
        } catch {
          // jsdom / synthetic events may not allow preventDefault; ignore.
        }
      }
      pausePending = true;
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
    consumePause(): boolean {
      if (!pausePending) return false;
      pausePending = false;
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

/** Touch / pointer input bound to three on-screen buttons (left, right,
 *  fire). Mirrors the keyboard source's contract exactly: hold-to-move on
 *  left/right (pointerdown → pressed=true, pointerup/cancel/leave → false),
 *  edge-triggered single shot on fire (pointerdown sets firePending; held
 *  presses do NOT auto-repeat, matching the 2-shot cap). Buttons use
 *  pointer events (not touch events) so the same code path drives mouse
 *  clicks for desktop testing AND finger taps on mobile.
 *
 *  setPointerCapture is called on pointerdown so the press tracks even if
 *  the finger slides off the button — without it, sliding off the LEFT
 *  pad would silently release left and the ship would drift back. */
export interface TouchInputElements {
  left: HTMLElement;
  right: HTMLElement;
  fire: HTMLElement;
}

export function createTouchInput(elements: TouchInputElements): InputSource {
  const pressed = { left: false, right: false };
  let firePending = false;
  const firstInputCbs: Array<() => void> = [];
  let firedFirstInput = false;

  const fireFirstInput = (): void => {
    if (firedFirstInput) return;
    firedFirstInput = true;
    for (const cb of firstInputCbs) cb();
  };

  // Per-button handlers we register, kept in a list so dispose() can detach
  // every listener cleanly. Each entry is [element, type, handler].
  const bindings: Array<[HTMLElement, string, EventListener]> = [];

  const bind = (
    el: HTMLElement,
    type: string,
    handler: (ev: PointerEvent) => void,
  ): void => {
    const wrapped = ((ev: Event) => handler(ev as PointerEvent)) as EventListener;
    el.addEventListener(type, wrapped, { passive: false });
    bindings.push([el, type, wrapped]);
  };

  const armDirection = (which: "left" | "right", el: HTMLElement): void => {
    bind(el, "pointerdown", (ev) => {
      if (typeof ev.preventDefault === "function") {
        try {
          ev.preventDefault();
        } catch {
          // Some synthetic events refuse preventDefault; safe to ignore.
        }
      }
      if (typeof el.setPointerCapture === "function" && ev.pointerId !== undefined) {
        try {
          el.setPointerCapture(ev.pointerId);
        } catch {
          // Capture is best-effort — older browsers / jsdom may refuse.
        }
      }
      pressed[which] = true;
      fireFirstInput();
    });
    const release = (ev: PointerEvent): void => {
      pressed[which] = false;
      if (
        typeof el.releasePointerCapture === "function" &&
        ev.pointerId !== undefined
      ) {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          // Releasing a capture we don't hold is harmless; ignore.
        }
      }
    };
    bind(el, "pointerup", release);
    bind(el, "pointercancel", release);
    // pointerleave covers the "finger slid off without capture" edge case
    // on browsers where setPointerCapture isn't available.
    bind(el, "pointerleave", release);
  };

  armDirection("left", elements.left);
  armDirection("right", elements.right);

  bind(elements.fire, "pointerdown", (ev) => {
    if (typeof ev.preventDefault === "function") {
      try {
        ev.preventDefault();
      } catch {
        // ignore — see armDirection.
      }
    }
    firePending = true;
    fireFirstInput();
  });

  return {
    read(): InputSnapshot {
      return { left: pressed.left, right: pressed.right };
    },
    consumeFire(): boolean {
      if (!firePending) return false;
      firePending = false;
      return true;
    },
    consumePause(): boolean {
      return false;
    },
    dispose(): void {
      for (const [el, type, handler] of bindings) {
        el.removeEventListener(type, handler);
      }
      bindings.length = 0;
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

/** Combine N input sources into one. The engine consumes a single
 *  InputSource so we hide the multi-device fan-in here: directions are
 *  OR'd across sources (holding LEFT on the keyboard while pressing
 *  RIGHT on the touch pad cancels exactly like both keys held), fire
 *  is the boolean OR of pending presses (drained from every source so
 *  no shot is silently swallowed), and onFirstInput fires once across
 *  the combined set. */
export function combineInputs(sources: InputSource[]): InputSource {
  const firstInputCbs: Array<() => void> = [];
  let firedFirstInput = false;
  const fireFirstInput = (): void => {
    if (firedFirstInput) return;
    firedFirstInput = true;
    for (const cb of firstInputCbs) cb();
  };
  for (const src of sources) {
    src.onFirstInput(fireFirstInput);
  }
  return {
    read(): InputSnapshot {
      let left = false;
      let right = false;
      for (const src of sources) {
        const snap = src.read();
        if (snap.left) left = true;
        if (snap.right) right = true;
      }
      return { left, right };
    },
    consumeFire(): boolean {
      // Drain EVERY source so a fire on either input lands; if we
      // short-circuited the boolean OR we'd leave a queued shot on the
      // un-checked source that the engine wouldn't see until next tick.
      let fired = false;
      for (const src of sources) {
        if (src.consumeFire()) fired = true;
      }
      return fired;
    },
    consumePause(): boolean {
      let paused = false;
      for (const src of sources) {
        if (src.consumePause()) paused = true;
      }
      return paused;
    },
    dispose(): void {
      for (const src of sources) src.dispose();
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

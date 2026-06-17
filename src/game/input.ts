// Keyboard input for Galaga — the first input slice (#31).
//
// Owns the keyboard listeners and exposes a tiny intent surface the engine
// reads each fixed-step update: `axis()` returns -1/0/+1 for "move left /
// idle / move right". Holding either direction key keeps the axis live until
// keyup, so movement is frame-rate-independent (engine multiplies by SPEED).
//
// The engine used to bind its own listener for the READY→playing flip; that
// behavior moves here so input has one home. The engine passes a `onStart`
// callback that fires on first key OR pointer-down — the existing harness
// test (click canvas, press ArrowLeft) keeps passing.
//
// Touch / on-screen joystick is a later slice (issue #31 scope is keyboard).

/** Logical horizontal axis. -1 = left, 0 = idle, +1 = right. */
export type Axis = -1 | 0 | 1;

export interface InputOptions {
  /** Element that receives pointer-down (for the READY tap-to-start). */
  pointerTarget: HTMLElement;
  /** Fired on the FIRST input event of any kind. Used to leave READY. */
  onStart: () => void;
}

/** A small keyboard adapter. Bind once in the engine ctor; read `axis()`
 *  from the fixed-step update. Tracks held keys via Set so simultaneous
 *  presses cancel cleanly (left+right = 0) instead of latching the last. */
export class KeyboardInput {
  private readonly held = new Set<string>();
  private started = false;
  private readonly onStart: () => void;

  constructor(opts: InputOptions) {
    this.onStart = opts.onStart;

    const fireStart = (): void => {
      if (this.started) return;
      this.started = true;
      this.onStart();
    };

    window.addEventListener("keydown", (e) => {
      // Track held keys regardless of which one fires the start.
      if (isMoveKey(e.key)) {
        this.held.add(e.key);
        // Avoid the browser scrolling the page on arrow keys when the
        // canvas has focus.
        e.preventDefault();
      }
      fireStart();
    });
    window.addEventListener("keyup", (e) => {
      this.held.delete(e.key);
    });
    opts.pointerTarget.addEventListener("pointerdown", fireStart);
  }

  /** Current horizontal intent. Left + Right held simultaneously cancel. */
  axis(): Axis {
    const left = this.held.has("ArrowLeft") || this.held.has("a") || this.held.has("A");
    const right = this.held.has("ArrowRight") || this.held.has("d") || this.held.has("D");
    if (left === right) return 0;
    return left ? -1 : 1;
  }
}

function isMoveKey(key: string): boolean {
  return (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "a" ||
    key === "A" ||
    key === "d" ||
    key === "D"
  );
}

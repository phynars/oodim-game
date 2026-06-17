// Keyboard input → queued Pac direction.
//
// We don't drive movement from key events directly — that would couple
// frame timing to OS keyrepeat. Instead, a keydown sets `pac.queued`,
// and the engine's tick honors it at the next tile boundary (see
// pacman.ts). That's what gives the controls their snappy "pre-turn"
// feel: you can flick the stick a hair before the corner and Pac
// rounds it cleanly.

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

export type InputBinding = {
  /** Detach the listener. Idempotent. */
  dispose(): void;
};

/** Bind keyboard input to a game state. Returns a disposer. */
export function bindInput(state: GameState, target: Window = window): InputBinding {
  const onKeyDown = (ev: KeyboardEvent): void => {
    const dir = KEY_TO_DIR[ev.code];
    if (!dir) return;
    state.pac.queued = dir;
    // If Pac is currently stopped (dir === 'none'), seed dir too so the
    // very first keypress kicks motion immediately rather than waiting
    // for the next tile boundary (there isn't one — Pac isn't moving).
    if (state.pac.dir === "none") {
      state.pac.dir = dir;
    }
    ev.preventDefault();
  };

  target.addEventListener("keydown", onKeyDown);

  let disposed = false;
  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      target.removeEventListener("keydown", onKeyDown);
    },
  };
}

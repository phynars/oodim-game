import { type GameState, initialState } from "./types";

// Reference maze dimensions (classic Pac-Man is 28×31 tiles). The scaffold only
// uses these to size the canvas + draw a placeholder; the real maze lands later.
export const TILE = 16;
export const COLS = 28;
export const ROWS = 31;

declare global {
  interface Window {
    /** Live game state, for the Playwright gameplay harness (e2e/pacman.spec.ts).
     *  Stable contract — assertions depend on it. */
    __pac?: GameState;
  }
}

/** The game engine: owns state, the requestAnimationFrame loop, and rendering.
 *  The scaffold renders a title/"ready" screen and keeps `window.__pac` in sync;
 *  update()/render() get fleshed out per the ordered Pac-Man backlog. */
export class Engine {
  readonly state: GameState = initialState();
  private readonly ctx: CanvasRenderingContext2D;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = COLS * TILE;
    canvas.height = ROWS * TILE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    window.__pac = this.state;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.tick);
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.update();
    this.render();
    this.state.frame++;
    requestAnimationFrame(this.tick);
  };

  /** Advance simulation one frame. Empty in the scaffold — gameplay lands here. */
  private update(): void {}

  private render(): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffce00";
    ctx.textAlign = "center";
    ctx.font = `${TILE * 1.5}px "Courier New", monospace`;
    ctx.fillText("oodim Game", canvas.width / 2, canvas.height / 2 - TILE);
    ctx.font = `${TILE}px "Courier New", monospace`;
    ctx.fillStyle = "#fff";
    ctx.fillText("PAC-MAN — coming together, one PR at a time", canvas.width / 2, canvas.height / 2 + TILE);
  }
}

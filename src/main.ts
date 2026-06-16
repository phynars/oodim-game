// Bootstrap: find the canvas, hand it to the Engine, start the loop.
// All real behavior lives in src/game/*. This file stays tiny on purpose —
// see docs/ARCHITECTURE.md.
import { Engine } from "./game/engine";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#game canvas not found");
}

const engine = new Engine(canvas);
engine.start();

import { Engine } from "./game/engine";

// Bootstrap: wire the canvas to the engine and start the loop.
const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#game canvas not found");
}
const engine = new Engine(canvas);
engine.start();

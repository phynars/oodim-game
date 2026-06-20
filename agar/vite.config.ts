import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// agar — the FOURTH product in the oodim Game portfolio. Self-contained:
// its own root (this agar/ dir), its own base path, its own dist. Will
// ship under https://game.oodim.com/agar/; the deploy workflow builds
// this into dist-agar/ and stages it under public/agar/ alongside the
// other games.
//
// Slice 1/4 — scaffold only. No DO, no websocket, no server. That lands
// in slice 2 (agar-01) with a wrangler config and worker entry alongside
// this vite config.
//
// `root` is pinned to this directory (not cwd) so the build works when
// run as `vite build --config agar/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/agar/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-agar (separate from the other
    // games' dist directories so per-game deploys never clobber).
    outDir: "../dist-agar",
    emptyOutDir: true,
  },
  server: {
    // Per-game dev/preview ports keep aggregate scripts able to run all
    // four products in parallel without collisions.
    port: 5274,
  },
  preview: {
    port: 4274,
  },
});

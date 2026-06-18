import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Doom — the THIRD product in the oodim Game portfolio, and the studio's first
// true-3D project (three.js + WebGL). Self-contained: its own root (this doom/
// dir), its own base path, its own dist. Pac-Man + Galaga are untouched. Ships
// under https://game.oodim.com/doom/; the deploy workflow builds this into
// dist-doom/ and stages it under public/doom/ alongside the others.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config doom/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/doom/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-doom (separate from the others' dist).
    outDir: "../dist-doom",
    emptyOutDir: true,
  },
  server: {
    port: 5373,
  },
  preview: {
    port: 4373,
  },
});

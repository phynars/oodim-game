import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Pac-Man — the first product in the oodim Game portfolio. Self-contained:
// its own root (this pacman/ dir), base path, and dist (mirrors galaga/).
// Ships under https://game.oodim.com/pacman/; the deploy workflow builds this
// into dist-pacman/ and stages it under public/pacman/.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config pacman/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/pacman/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-pacman (separate from Galaga's dist).
    outDir: "../dist-pacman",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});

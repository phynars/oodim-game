import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Galaga — the SECOND product in the oodim Game portfolio. Self-contained:
// its own root (this galaga/ dir), its own base path, its own dist. Pac-Man
// at the repo root is untouched. Ships under https://game.oodim.com/galaga/;
// the deploy workflow builds this into dist-galaga/ and stages it under
// public/galaga/ alongside public/pacman/.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config galaga/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/galaga/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-galaga (separate from Pac-Man's dist).
    outDir: "../dist-galaga",
    emptyOutDir: true,
  },
  server: {
    port: 5273,
  },
  preview: {
    port: 4273,
  },
});

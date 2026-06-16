import { defineConfig } from "vite";

// Ships under https://game.oodim.com/pacman/. The deploy workflow copies
// dist/* into public/pacman/, so the built assets must be relative to that
// subpath.
export default defineConfig({
  base: "/pacman/",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});

import { defineConfig } from "vite";

// Ships to https://game.oodim.com/pacman/ — so assets must resolve under that
// base path, not the domain root.
export default defineConfig({
  base: "/pacman/",
  build: { outDir: "dist", sourcemap: true },
  server: { port: 5173 },
  preview: { port: 4173 },
});

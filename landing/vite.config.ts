import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Landing page at game.oodim.com/ — the portfolio index that lists
 * shipped games and links into each subpath build (/pacman/, /galaga/).
 *
 * Plain HTML/CSS, no framework. Built into ../dist-landing so it sits
 * next to dist-pacman and dist-galaga and can be assembled into one
 * deploy directory at the site root.
 */
export default defineConfig({
  root: resolve(__dirname),
  base: "/",
  build: {
    outDir: resolve(__dirname, "../dist-landing"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
});

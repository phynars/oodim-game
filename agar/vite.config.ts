import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Agar — the fourth product in the oodim Game portfolio, and the studio's
// first multiplayer prototype. This config is the scaffold half (agar-00):
// build a self-contained client that mounts a canvas at /agar/, so the deploy
// workflow's dist-*/ → public/<name>/ auto-staging publishes us to
// https://game.oodim.com/agar/. Server (Durable Object), websocket, and tick
// arrive in agar-01/02 — keep this config to just the client shell.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config agar/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/agar/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-agar (separate from siblings').
    outDir: "../dist-agar",
    emptyOutDir: true,
  },
  server: {
    port: 5176,
  },
  preview: {
    port: 4176,
  },
});

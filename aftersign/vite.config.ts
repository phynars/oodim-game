import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// AFTERSIGN — the flagship's first playable vertical slice (Io remembers the
// blue packet outcome across sessions). Self-contained product like the other
// four: its own root, its own base path, its own dist. Ships under
// https://game.oodim.com/aftersign/; the deploy workflow auto-derives the
// stage from dist-aftersign/ once vite build emits it.
//
// Why this file exists (2026-07-05): the product-wiring guard keys off
// `<name>/vite.config.ts` — without it, aftersign is invisible to CI and any
// harness spec under aftersign/e2e/ gates nothing. Test that never runs =
// test that says green forever. See scripts/check-product-wiring.mjs.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config aftersign/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "/aftersign/",
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-aftersign (separate per-product dist).
    outDir: "../dist-aftersign",
    emptyOutDir: true,
    rollupOptions: {
      // The current index.html imports three.js from esm.sh as absolute URLs
      // — leave them external so Rollup doesn't try to resolve/bundle them.
      // (When the slice's TS scene lands and switches to the `three` npm dep,
      // this line can go.)
      external: (id) => /^https?:\/\//.test(id),
    },
  },
  server: {
    port: 5374,
  },
  preview: {
    port: 4374,
  },
});

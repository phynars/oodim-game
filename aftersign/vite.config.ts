import { defineConfig } from "vite";

export default defineConfig({
  base: "/aftersign/",
  build: {
    outDir: "../dist/aftersign",
    emptyOutDir: true,
  },
});

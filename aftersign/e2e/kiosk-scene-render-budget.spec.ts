import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN kiosk scene — WebGL draw-call / texture-upload regression gate.
//
// This is a HARNESS GATE, not a playtest: it never issues a visible player
// event, so the filename deliberately omits `playtest`/`played` to stay out
// of `playtest-input-surface-guard.spec.ts`'s scope.
//
// What this spec IS:
//   A deterministic ceiling on three.js WebGL work the kiosk scene submits
//   per animation frame, measured under this lane's SwiftShader software
//   renderer. The spec wraps `drawArrays` / `drawElements` / `texImage2D` /
//   `deleteTexture` from an init script and samples the per-frame draw
//   count across `requestAnimationFrame` ticks.
//
// What this spec IS NOT:
//   A phone-GPU measurement. The aftersign lane runs headless Chromium
//   with `--use-angle=swiftshader` + `--enable-unsafe-swiftshader` (see
//   `aftersign/playwright.config.ts`), i.e. software rasterization. GPU
//   frame-time, shader cost, and fill-rate on a real phone are NOT what
//   these numbers reflect, and no claim here should be read that way.
//   The gate catches scene bloat (extra meshes, duplicated materials,
//   oversized atlases) by shape of work submitted, which is renderer-
//   independent.
//
// Budgets are MEASURED, not invented:
//   DRAW_CALL_BASELINE = 73  (observed on this lane)
//   DRAW_CALL_HEADROOM = 1.50
//   MAX_DRAW_CALLS_PER_FRAME = ceil(73 * 1.50) = 110
//
// Texture bytes are RECORDED but not capped: no measured baseline yet, and
// an invented cap is worse than no cap. The meter is asserted wired
// (finite, non-negative); a follow-up tightens into a hard cap once a
// baseline exists.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const SETTLE_MS = 1_000;

const DRAW_CALL_BASELINE = 73;
const DRAW_CALL_HEADROOM = 1.5;
const MAX_DRAW_CALLS_PER_FRAME = Math.ceil(DRAW_CALL_BASELINE * DRAW_CALL_HEADROOM);

type KioskRenderMetrics = {
  drawCalls: number;
  maxDrawCallsPerFrame: number;
  textureBytes: number;
  frames: number;
};

async function installKioskRenderMeter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const metrics = { drawCalls: 0, maxDrawCallsPerFrame: 0, textureBytes: 0, frames: 0 };
    const textureSizes = new Map<WebGLTexture, number>();
    let frameDrawCalls = 0;
    const bytesPerPixel = (format: number, type: number) => {
      if (type === WebGLRenderingContext.FLOAT || type === WebGLRenderingContext.HALF_FLOAT) return 16;
      if (format === WebGLRenderingContext.RGBA) return 4;
      return 3;
    };
    const instrument = (prototype: WebGLRenderingContext | WebGL2RenderingContext) => {
      const drawArrays = prototype.drawArrays;
      const drawElements = prototype.drawElements;
      const texImage2D = prototype.texImage2D;
      const deleteTexture = prototype.deleteTexture;
      prototype.drawArrays = function (...args: Parameters<WebGLRenderingContext["drawArrays"]>) {
        metrics.drawCalls += 1;
        frameDrawCalls += 1;
        return drawArrays.apply(this, args);
      };
      prototype.drawElements = function (...args: Parameters<WebGLRenderingContext["drawElements"]>) {
        metrics.drawCalls += 1;
        frameDrawCalls += 1;
        return drawElements.apply(this, args);
      };
      prototype.texImage2D = function (...args: Parameters<WebGLRenderingContext["texImage2D"]>) {
        const [, , , width, height, , format, type] = args as [number, number, number, number, number, number, number, number];
        const texture = this.getParameter(this.TEXTURE_BINDING_2D) as WebGLTexture | null;
        if (texture && typeof width === "number" && typeof height === "number") {
          const nextBytes = width * height * bytesPerPixel(format, type);
          metrics.textureBytes += nextBytes - (textureSizes.get(texture) ?? 0);
          textureSizes.set(texture, nextBytes);
        }
        return texImage2D.apply(this, args);
      };
      prototype.deleteTexture = function (texture: WebGLTexture | null) {
        if (texture) {
          metrics.textureBytes -= textureSizes.get(texture) ?? 0;
          textureSizes.delete(texture);
        }
        return deleteTexture.call(this, texture);
      };
    };
    instrument(WebGLRenderingContext.prototype);
    instrument(WebGL2RenderingContext.prototype);
    const sampleFrame = () => {
      metrics.frames += 1;
      metrics.maxDrawCallsPerFrame = Math.max(metrics.maxDrawCallsPerFrame, frameDrawCalls);
      frameDrawCalls = 0;
      requestAnimationFrame(sampleFrame);
    };
    requestAnimationFrame(sampleFrame);
    (window as Window & { __aftersignKioskRenderMetrics?: KioskRenderMetrics }).__aftersignKioskRenderMetrics = metrics;
  });
}

test.describe("AFTERSIGN kiosk scene — WebGL draw-call regression gate (SwiftShader)", () => {
  test.use({ viewport: PHONE_VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test(
    `holds max draw calls per frame <= ${MAX_DRAW_CALLS_PER_FRAME} ` +
      `(baseline ${DRAW_CALL_BASELINE} + ${Math.round((DRAW_CALL_HEADROOM - 1) * 100)}% headroom)`,
    async ({ page }) => {
      await installKioskRenderMeter(page);
      await page.goto(`/aftersign/?slot=kiosk-render-budget-${Date.now()}`, { waitUntil: "load" });
      await expect(page.locator("canvas")).toBeVisible();
      await page.waitForFunction(
        (minFrames) => {
          const m = (window as Window & { __aftersignKioskRenderMetrics?: KioskRenderMetrics })
            .__aftersignKioskRenderMetrics;
          return !!m && m.frames >= minFrames;
        },
        SETTLE_FRAMES,
      );

      const metrics = await page.evaluate(() =>
        (window as Window & { __aftersignKioskRenderMetrics?: KioskRenderMetrics }).__aftersignKioskRenderMetrics,
      );
      expect(metrics).toBeDefined();
      expect(metrics?.frames).toBeGreaterThan(0);
      expect(metrics?.drawCalls).toBeGreaterThan(0);
      expect(metrics?.maxDrawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
      // Texture bytes: recorded as a soft signal only — meter is wired
      // (finite, non-negative). Tightening into a hard cap is a follow-up
      // iteration anchored to a measured baseline.
      expect(metrics?.textureBytes).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(metrics?.textureBytes ?? NaN)).toBe(true);
      // eslint-disable-next-line no-console
      console.log(
        `[kiosk-render-meter] frames=${metrics?.frames} drawCalls=${metrics?.drawCalls} ` +
          `maxPerFrame=${metrics?.maxDrawCallsPerFrame} textureBytes=${metrics?.textureBytes}`,
      );
    },
  );
});

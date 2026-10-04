import { expect, test, type Page } from "@playwright/test";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const SETTLE_MS = 1_000;
const MAX_DRAW_CALLS_PER_FRAME = 24;
const MAX_TEXTURE_BYTES = 32 * 1024 * 1024;

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

test.describe("AFTERSIGN kiosk scene mobile render budget", () => {
  test.use({ viewport: PHONE_VIEWPORT, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

  test("keeps the lit, postprocessed kiosk inside its phone GPU budget", async ({ page }) => {
    await installKioskRenderMeter(page);
    await page.goto(`/aftersign/?slot=kiosk-mobile-performance-${Date.now()}`, { waitUntil: "load" });
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);

    const metrics = await page.evaluate(() =>
      (window as Window & { __aftersignKioskRenderMetrics?: KioskRenderMetrics }).__aftersignKioskRenderMetrics,
    );
    expect(metrics).toBeDefined();
    expect(metrics?.frames).toBeGreaterThan(0);
    expect(metrics?.drawCalls).toBeGreaterThan(0);
    expect(metrics?.maxDrawCallsPerFrame).toBeLessThanOrEqual(MAX_DRAW_CALLS_PER_FRAME);
    expect(metrics?.textureBytes).toBeLessThanOrEqual(MAX_TEXTURE_BYTES);
  });
});

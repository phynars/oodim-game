import { expect, test, type Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

declare global {
  interface Window {
    __game?: {
      version?: number;
      slug?: string;
      scene?: {
        id?: string;
        act?: string;
        ready?: boolean;
        beat?: string;
      };
      cameraRig?: {
        position?: { x?: number; y?: number; z?: number };
        lookAt?: { x?: number; y?: number; z?: number };
      } | null;
    };
  }
}

function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

test.describe("AFTERSIGN kiosk scene init contract", () => {
  test("publishes the first 3D kiosk scene with an active canvas and camera rig", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "kiosk-scene-init");

    await page.goto(`/aftersign/?slot=kiosk-scene-init-${Date.now()}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game?.version === 1, undefined, {
      timeout: WAIT_MS,
    });

    const boot = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("#scene");
      const rect = canvas?.getBoundingClientRect();
      const webglReady = Boolean(canvas?.getContext("webgl2") || canvas?.getContext("webgl"));

      return {
        slug: window.__game?.slug,
        scene: window.__game?.scene,
        canvas: rect
          ? {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              ariaLabel: canvas?.getAttribute("aria-label"),
              webglReady,
            }
          : null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    });

    expect(boot.slug).toBe("aftersign");
    expect(boot.scene?.id).toBe("io-night-post-kiosk");
    expect(boot.scene?.act).toBe("act-1-seal");
    expect(boot.scene?.beat).toBe("packet-offered");
    expect(boot.scene?.ready).toBe(true);
    expect(boot.canvas?.ariaLabel).toBe("AFTERSIGN first kiosk scene");
    expect(boot.canvas?.webglReady).toBe(true);
    expect(boot.canvas?.width).toBe(boot.viewport.width);
    expect(boot.canvas?.height).toBe(boot.viewport.height);

    await page.waitForFunction(
      () => {
        const rig = window.__game?.cameraRig;
        return Boolean(
          rig?.position
            && Number.isFinite(rig.position.x)
            && Number.isFinite(rig.position.y)
            && Number.isFinite(rig.position.z)
            && rig?.lookAt
            && Number.isFinite(rig.lookAt.x)
            && Number.isFinite(rig.lookAt.y)
            && Number.isFinite(rig.lookAt.z),
        );
      },
      undefined,
      { timeout: WAIT_MS },
    );

    const cameraRig = await page.evaluate(() => window.__game?.cameraRig);
    expect(cameraRig?.position?.y).toBeGreaterThan(0);
    expect(cameraRig?.position?.z).toBeGreaterThan(0);
    expect(cameraRig?.lookAt?.y).toBeGreaterThan(0);
  });
});

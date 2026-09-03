import { expect, test } from "@playwright/test";

// PLAYED-NOT-DRIVEN failure-sting spec. Drives a REAL pointer gesture
// (page.mouse.down / move / up) on the served #packetButton so the
// PacketIntentController's `pointermove > DRIFT_CANCEL_PX` guard
// commits CANCELLED through the same DOM listeners a player's finger
// hits. The harness-driven sibling (packet-hold-threshold.spec.ts)
// covers the pure controller wiring; this one closes the "did the
// served page's DOM adapter reach the controller?" gap.
//
// Cold-start budget matches other AFTERSIGN e2e specs — SwiftShader +
// esm.sh three.js imports can exceed Playwright's default 30s.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type PacketOutcome = "unknown" | "sealed" | "opened" | "cancelled";

type FailureFeedbackShape = {
  active: boolean;
  remainingMs: number;
  durationMs: number;
  flashAlpha: number;
  hudShakePx: number;
  hudDropPx: number;
  easing: string;
};

type FailureReadout = {
  lastAction: string | null;
  failureStartedAt: number | null;
  packetIntentActive: boolean;
  packetIntentOutcome: PacketOutcome | null;
  beat: string | null;
  feedback: FailureFeedbackShape | null;
  flashOpacity: number;
  shakeX: string;
  shakeY: string;
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      resetSliceSave?: () => void;
      scene?: { ready?: boolean; beat?: string };
      interaction?: {
        lastAction?: string | null;
        failureStartedAt?: number | null;
        failureFeedback?: FailureFeedbackShape;
        packetIntent?: {
          active: boolean;
          outcome: PacketOutcome;
        };
      };
    };
  }
}

const slot = `failure-sting-played-${Date.now()}`;

const readFailureFeedback = async (page): Promise<FailureReadout> =>
  page.evaluate((): FailureReadout => {
    const game = window.__game;
    const failureSting = document.querySelector(".failure-sting") as HTMLElement | null;
    const flashOpacity = failureSting
      ? Number.parseFloat(getComputedStyle(failureSting).opacity || "0")
      : 0;
    return {
      lastAction: game?.interaction?.lastAction ?? null,
      failureStartedAt: game?.interaction?.failureStartedAt ?? null,
      packetIntentActive: game?.interaction?.packetIntent?.active ?? false,
      packetIntentOutcome: game?.interaction?.packetIntent?.outcome ?? null,
      beat: game?.scene?.beat ?? null,
      feedback: game?.interaction?.failureFeedback
        ? {
            active: game.interaction.failureFeedback.active,
            remainingMs: game.interaction.failureFeedback.remainingMs,
            durationMs: game.interaction.failureFeedback.durationMs,
            flashAlpha: game.interaction.failureFeedback.flashAlpha,
            hudShakePx: game.interaction.failureFeedback.hudShakePx,
            hudDropPx: game.interaction.failureFeedback.hudDropPx,
            easing: game.interaction.failureFeedback.easing,
          }
        : null,
      flashOpacity: Number.isFinite(flashOpacity) ? flashOpacity : 0,
      shakeX: getComputedStyle(document.documentElement)
        .getPropertyValue("--confirm-shake-x")
        .trim(),
      shakeY: getComputedStyle(document.documentElement)
        .getPropertyValue("--confirm-shake-y")
        .trim(),
    };
  });

test.describe("packet cancel failure sting — played surface", () => {
  test("a real drift-cancel tap arms the 180ms/8px/0.34 failure sting on the served page", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);

    page.on("pageerror", (err) => {
      // eslint-disable-next-line no-console
      console.error(`[aftersign failure-sting-played] pageerror:`, err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // eslint-disable-next-line no-console
        console.error(
          `[aftersign failure-sting-played] console.error:`,
          msg.text(),
        );
      }
    });

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // Boot gate: same version + scene.ready shape the sibling
    // packet-intent-served-page-feel.spec.ts uses.
    await page.waitForFunction(
      () => window.__game?.version === 1 && window.__game.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    // Reset persisted slot so we ENTER on beat "packet-offered" —
    // otherwise a stale slot could park the beat elsewhere, packetPress
    // would return early, the trigger would never fire, and the shape
    // poll below would time out on `active: true` (the exact -1/+1
    // `toMatchObject` diff the prior CI red showed).
    await page.evaluate(() => window.__game?.resetSliceSave?.());
    await page.waitForFunction(
      () => window.__game?.scene?.beat === "packet-offered",
      undefined,
      { timeout: WAIT_MS },
    );

    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible();

    const box = await packet.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Real drift-cancel gesture: pointerdown on the packet, drag past
    // the STRICT `pullPx > DRIFT_CANCEL_PX=14` guard (see
    // aftersign/src/packetIntent.ts:111), then release. 22px past the
    // start is well beyond the 14px guard — same delta the harness
    // sibling packet-hold-threshold.spec.ts uses (100 → 122).
    //
    // Steps>1 emits N pointermove events; the intermediate positions
    // let the controller sample the drift and commit CANCELLED at
    // the first crossing frame. The release closes the gesture so
    // the shipped rAF loop can sample `now - failureStartedAt` past
    // the 180ms envelope end without a captured pointer holding
    // the element (a shipped player lifts after a mis-swipe).
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 22, startY, { steps: 6 });
    await page.mouse.up();

    // Arm confirmation FIRST — decouple "did the gesture reach the
    // controller?" from "does state carry the pinned feel row?".
    // If this times out, the DOM adapter (aftersign/src/runtime/
    // inputAdapters.js) never mapped the real pointermove into
    // packetMove — the "played surface shape" contract broke, and
    // the shape assertion below would report a confusing -1/+1 on
    // `active` instead of the real defect.
    await expect
      .poll(async () => (await readFailureFeedback(page)).failureStartedAt, {
        timeout: 5_000,
        intervals: [50, 100, 200],
      })
      .not.toBeNull();

    // Same-frame verify: the packet-intent controller committed
    // CANCELLED, `lastAction` reads as `packet-cancelled`, and the
    // failureFeedback envelope carries the FULL pinned feel row
    // (not just the two per-frame mirrored fields). Contract source
    // is aftersign/src/failureStingFeedback.ts's module comment:
    // "state.interaction.failureFeedback mirrors ONLY {active,
    // remainingMs} off this envelope; the feel constants stay pinned
    // on state so the e2e's `.toBe(0.34)` assertion holds every
    // frame, not just at t=0."
    const armed = await readFailureFeedback(page);
    expect(armed.packetIntentOutcome).toBe("cancelled");
    expect(armed.lastAction).toBe("packet-cancelled");
    expect(armed.feedback).not.toBeNull();
    expect(armed.feedback!.durationMs).toBe(180);
    expect(armed.feedback!.flashAlpha).toBe(0.34);
    expect(armed.feedback!.hudShakePx).toBe(8);
    expect(armed.feedback!.hudDropPx).toBe(2);
    expect(armed.feedback!.easing).toBe("easeOutQuad");
    expect(armed.feedback!.remainingMs).toBeGreaterThan(0);
    expect(armed.feedback!.remainingMs).toBeLessThanOrEqual(180);

    // The DOM juice channels the same envelope: HUD shake variables
    // exist (even when the sample lands on the zero-crossing of the
    // wobble, the `--confirm-shake-*` custom properties are stamped),
    // and the flash-sting DIV overlays under the 0.34 pinned alpha.
    expect(armed.shakeX.length).toBeGreaterThan(0);
    expect(armed.shakeY.length).toBeGreaterThan(0);
    expect(armed.flashOpacity).toBeGreaterThanOrEqual(0);
    expect(armed.flashOpacity).toBeLessThanOrEqual(0.34);

    // Envelope decays on the wall clock from trigger time. Budget:
    // 180ms envelope + up to one rAF frame (~17ms) for the loop to
    // sample the deactivation + generous scheduling headroom for a
    // slow CI worker. `failureStartedAt` is stamped at trigger, and
    // the rAF loop (aftersign/main.js:3807-3821) flips `active` to
    // false and clears `failureStartedAt` once
    // `failureStingEnvelopeAt(now - failureStartedAt).active === false`.
    // 3000ms is well past the mathematical floor and well under
    // Playwright's default expect timeout.
    await expect
      .poll(async () => (await readFailureFeedback(page)).feedback?.active, {
        timeout: 3_000,
        intervals: [50, 100, 200],
      })
      .toBe(false);

    // Post-decay: `failureStartedAt` is cleared to null (the rAF loop
    // does this in the same tick it flips active to false). This
    // guards against a "sting stuck armed" regression where the
    // envelope decays but the trigger stamp never releases — the
    // exact shape the prior red CI's 2500ms `active === true`
    // timeout would take.
    const decayed = await readFailureFeedback(page);
    expect(decayed.failureStartedAt).toBeNull();
    expect(decayed.feedback!.active).toBe(false);
    expect(decayed.feedback!.remainingMs).toBe(0);
  });
});

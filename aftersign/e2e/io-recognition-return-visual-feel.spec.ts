import { expect, test, type Page } from "@playwright/test";

// Visual-feel spec for Io's returning-session recognition beat.
//
// This spec is deliberately anchored to the SAME surface the runtime
// actually publishes from aftersign/main.js `publishState`:
//   - scene.beat                            (top-level)
//   - story.memoryBeat.{kind,outcome,startedAt,endedAt,
//                       cameraDeltaMeters,cameraYawDegrees,inputLockMs,lineId}
//   - npcs.io.lastLine / npcs.io.lastLineMemoryRefs
//   - interaction.recognitionFeedback.{durationMs,cameraDeltaMeters,cameraYawDegrees}
//
// It does NOT read a `recognition` object, a `debug` object, or a
// top-level `lastNpcLine` — none of those exist on window.__game.
// It drives the beat the way the sibling
// io-recognition-memory-beat-contract.spec.ts does: navigate with
// ?slot=…, wait for window.__game.input, then
// choose('keep-packet-sealed') → choose('deliver-packet') → advance().
// The seeded-save mechanism keys off ?slot= (localStorage key
// `aftersign:kiosk-slice:${slot}`), not ?player=/?seed=.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type RecognitionOutcome = "sealed" | "opened";

type MemoryBeat = {
  kind: "io_packet_return";
  outcome: RecognitionOutcome;
  startedAt: number;
  endedAt: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  inputLockMs: number;
  lineId: string;
};

// Bounds mirror the sibling io-recognition-memory-beat-contract spec so
// this "visual feel" surface stays consistent with the durable memory
// beat contract. Any drift here means one of the two specs is wrong
// about the runtime — not that the runtime has two contracts.
const BEAT_LIMITS = {
  durationMs: { min: 1100, max: 1350 },
  cameraDeltaMeters: { min: 0.24, max: 0.36 },
  cameraYawDegrees: { min: 3, max: 5 },
  inputLockMsMax: 1220,
} as const;

// The two verbatim lines Io speaks at io-return-recognition (see
// aftersign/main.js `lineForBeat`).
// Canonical copy module (#595 cleanup, #1077); these flows skip the
// kiosk route, so the RETURNING tier speaks.
import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";
const SEALED_RECOGNITION_LINE = expectedIoRecognitionLine("sealed", false);
const OPENED_RECOGNITION_LINE = expectedIoRecognitionLine("opened", false);

const EXPECTED_LINE: Record<RecognitionOutcome, string> = {
  sealed: SEALED_RECOGNITION_LINE,
  opened: OPENED_RECOGNITION_LINE,
};

const EXPECTED_LINE_ID: Record<RecognitionOutcome, string> = {
  sealed: "io_return_packet_sealed",
  opened: "io_return_packet_opened",
};

const waitForGame = async (page: Page) => {
  await page.waitForFunction(
    () =>
      Boolean(
        (window as Window & {
          __game?: { input?: { choose?: unknown; advance?: unknown; forceReload?: unknown } };
        }).__game?.input?.choose
          && (window as Window & {
            __game?: { input?: { advance?: unknown } };
          }).__game?.input?.advance
          && (window as Window & {
            __game?: { input?: { forceReload?: unknown } };
          }).__game?.input?.forceReload,
      ),
    undefined,
    { timeout: WAIT_MS },
  );
};

const driveRecognition = async (page: Page, outcome: RecognitionOutcome) => {
  await waitForGame(page);
  await page.evaluate(async (nextOutcome) => {
    const game = (window as Window & {
      __game?: {
        input?: {
          choose?: (choiceId: string) => Promise<void>;
          advance?: () => Promise<void>;
          forceReload?: () => Promise<void>;
        };
        story?: { memoryBeat?: unknown };
      };
    }).__game;
    if (!game?.input?.choose || !game.input.advance || !game.input.forceReload) {
      throw new Error("window.__game.input is not available");
    }

    await game.input.forceReload();
    if (game.story) {
      game.story.memoryBeat = null;
    }
    await game.input.choose(nextOutcome === "sealed" ? "keep-packet-sealed" : "open-packet");
    await game.input.choose("deliver-packet");
    await game.input.advance();
  }, outcome);
};

// Variant used by the impact-burst spec below: runs everything EXCEPT
// the final `advance()` — the caller dispatches advance() as its own
// small evaluate right before the rAF pump starts, so the 260ms
// impact-burst window (armed inside advance()) does not open while a
// long-lived page.evaluate is blocking Playwright's ability to drive
// rAF frames from outside. See the pump-loop comment in the
// impact-burst test for full context (#1128).
const driveRecognitionExceptAdvance = async (page: Page, outcome: RecognitionOutcome) => {
  await waitForGame(page);
  await page.evaluate(async (nextOutcome) => {
    const game = (window as Window & {
      __game?: {
        input?: {
          choose?: (choiceId: string) => Promise<void>;
          forceReload?: () => Promise<void>;
        };
        story?: { memoryBeat?: unknown };
      };
    }).__game;
    if (!game?.input?.choose || !game.input.forceReload) {
      throw new Error("window.__game.input is not available");
    }

    await game.input.forceReload();
    if (game.story) {
      game.story.memoryBeat = null;
    }
    await game.input.choose(nextOutcome === "sealed" ? "keep-packet-sealed" : "open-packet");
    await game.input.choose("deliver-packet");
  }, outcome);
};

// Wait until state.story.memoryBeat has been populated with the expected
// outcome. deliverPacket() arms a ~1180ms setTimeout that publishes the
// beat, so we poll rather than assume any single frame.
const waitForMemoryBeat = async (page: Page, outcome: RecognitionOutcome) => {
  const handle = await page.waitForFunction(
    (expected) => {
      const beat =
        (window as Window & {
          __game?: { story?: { memoryBeat?: { outcome?: string } | null } };
        }).__game?.story?.memoryBeat ?? null;
      return beat && beat.outcome === expected ? beat : null;
    },
    outcome,
    { timeout: WAIT_MS },
  );
  return (await handle.jsonValue()) as MemoryBeat;
};

type FeelSnapshot = {
  sceneBeat: string;
  storyCurrentNpcId: string | null;
  memoryBeat: MemoryBeat;
  ioLastLine: string;
  ioLastLineMemoryRefs: string[];
  recognitionFeedback: {
    durationMs?: number;
    cameraDeltaMeters?: number;
    cameraYawDegrees?: number;
  };
};

const readFeelSnapshot = async (page: Page): Promise<FeelSnapshot> => {
  return page.evaluate(() => {
    const game = (window as Window & {
      __game?: {
        scene?: { beat?: string };
        story?: { currentNpcId?: string | null; memoryBeat?: unknown };
        npcs?: { io?: { lastLine?: string | null; lastLineMemoryRefs?: string[] } };
        interaction?: {
          recognitionFeedback?: {
            durationMs?: number;
            cameraDeltaMeters?: number;
            cameraYawDegrees?: number;
          };
        };
      };
    }).__game;
    if (!game) throw new Error("window.__game is not available");
    return {
      sceneBeat: game.scene?.beat ?? "",
      storyCurrentNpcId: game.story?.currentNpcId ?? null,
      memoryBeat: (game.story?.memoryBeat ?? null) as MemoryBeat,
      ioLastLine: game.npcs?.io?.lastLine ?? "",
      ioLastLineMemoryRefs: game.npcs?.io?.lastLineMemoryRefs ?? [],
      recognitionFeedback: game.interaction?.recognitionFeedback ?? {},
    };
  });
};

const assertVisualFeel = (snapshot: FeelSnapshot, outcome: RecognitionOutcome) => {
  // Scene has actually transitioned into the recognition beat, and the
  // story lane knows Io is the current speaker.
  expect(snapshot.sceneBeat).toBe("io-return-recognition");
  expect(snapshot.storyCurrentNpcId).toBe("io");

  // Durable memory beat shape (matches the sibling contract spec).
  const beat = snapshot.memoryBeat;
  expect(beat).toBeTruthy();
  expect(beat.kind).toBe("io_packet_return");
  expect(beat.outcome).toBe(outcome);
  expect(beat.lineId).toBe(EXPECTED_LINE_ID[outcome]);

  const durationMs = beat.endedAt - beat.startedAt;
  expect(durationMs).toBeGreaterThanOrEqual(BEAT_LIMITS.durationMs.min);
  expect(durationMs).toBeLessThanOrEqual(BEAT_LIMITS.durationMs.max);

  expect(beat.cameraDeltaMeters).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(beat.cameraDeltaMeters).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(beat.cameraYawDegrees).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(beat.cameraYawDegrees).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
  expect(beat.inputLockMs).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);

  // Spoken line matches the outcome verbatim, and lastLineMemoryRefs
  // is populated (io-return-recognition is the beat that references
  // the delivery-outcome memory fact).
  expect(snapshot.ioLastLine).toBe(EXPECTED_LINE[outcome]);
  expect(snapshot.ioLastLineMemoryRefs.length).toBeGreaterThan(0);

  // The LIVE recognition feedback envelope (interaction.recognitionFeedback)
  // is the surface the visual layer reads to drive camera + glow amplitudes
  // during the beat. It's populated from IO_RECOGNITION_BEAT_FEEDBACK at
  // module init and can be zeroed by the harness — assert it is present
  // and inside the same camera-motion band as the durable beat.
  const feel = snapshot.recognitionFeedback;
  expect(typeof feel.durationMs).toBe("number");
  expect(feel.durationMs!).toBeGreaterThan(0);
  expect(feel.durationMs!).toBeLessThanOrEqual(BEAT_LIMITS.inputLockMsMax);
  expect(typeof feel.cameraDeltaMeters).toBe("number");
  expect(feel.cameraDeltaMeters!).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.min);
  expect(feel.cameraDeltaMeters!).toBeLessThanOrEqual(BEAT_LIMITS.cameraDeltaMeters.max);
  expect(typeof feel.cameraYawDegrees).toBe("number");
  expect(feel.cameraYawDegrees!).toBeGreaterThanOrEqual(BEAT_LIMITS.cameraYawDegrees.min);
  expect(feel.cameraYawDegrees!).toBeLessThanOrEqual(BEAT_LIMITS.cameraYawDegrees.max);
};

test("io return recognition publishes readable visual-feel numbers (sealed)", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-return-visual-feel-sealed", { waitUntil: "load" });

  await driveRecognition(page, "sealed");
  await waitForMemoryBeat(page, "sealed");
  const snapshot = await readFeelSnapshot(page);
  assertVisualFeel(snapshot, "sealed");
});

test("io return recognition publishes readable visual-feel numbers (opened)", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-return-visual-feel-opened", { waitUntil: "load" });

  await driveRecognition(page, "opened");
  await waitForMemoryBeat(page, "opened");
  const snapshot = await readFeelSnapshot(page);
  assertVisualFeel(snapshot, "opened");
});

// #1104 acceptance criterion #3: main.js render loop must spawn particle
// DOM primitives at the NPC eye position when the envelope's impact-burst
// window is active. The envelope emits 14 particles at frame 4 (≈187ms
// after beat start) for a 260ms window; the render tick reconciles child
// `.impact-burst-particle` nodes under `#recognitionImpactBurst`. This
// spec drives recognition, then polls the DOM until the burst window
// paints — proving the published `interaction.impactBurstParticles` list
// has been consumed by an actual render path, not merely computed.
test("io return recognition spawns 14 particle primitives during the impact-burst window", async ({ page }) => {
  test.setTimeout(COLD_START_MS);
  await page.goto("/aftersign/index.html?slot=io-return-impact-burst", { waitUntil: "load" });

  // Run the reload + choice sequence, but hold back the `advance()`
  // that arms the 260ms impact-burst window (#1128 fix). Previously
  // driveRecognition() ran `advance()` inside the SAME long-lived
  // page.evaluate as the reload + choose calls — on SwiftShader
  // cold-start that evaluate can hold the node<->page bridge for
  // >260ms, meaning the burst window opens AND closes before the pump
  // loop below ever gets a chance to drive an outside-rAF frame. The
  // MutationObserver then legitimately records zero paints and the
  // spec times out on a healthy build (main went red exactly this way
  // — issue #1128). Splitting `advance()` into its own tiny evaluate
  // right before the pump keeps the burst-armed → pump gap under one
  // bridge hop; the pump then reliably observes the 14-particle paint.
  //
  // NOTE (PR #1129 iter 7 fix): the MutationObserver MUST be installed
  // AFTER `driveRecognitionExceptAdvance` — that helper calls
  // `input.forceReload()`, which rebuilds the DOM tree wholesale. If we
  // installed the observer BEFORE forceReload (as prior iterations of
  // this PR did), it was watching a detached #recognitionImpactBurst
  // node and never saw a single childList mutation — that's why
  // domCount stayed at 0 even though the burst was firing. Installing
  // AFTER forceReload but BEFORE advance() puts the observer on the
  // LIVE overlay before the burst window arms.
  await driveRecognitionExceptAdvance(page, "sealed");

  // Kick off the recognition beat. `driveRecognition` returns as soon as
  // the last input is dispatched — it does NOT wait for the ~1180ms beat
  // to end. That matters here because the impact-burst window
  // (particleBurstStartFrame=4 @60fps → ~67ms after anticipation hold →
  // ~187ms after beat start, for a 260ms duration) closes long before
  // `waitForMemoryBeat` would return. If we waited on the beat to finish,
  // the burst would already be over and the DOM would have zero
  // primitives.
  // Observation-complete counting (#1113 follow-up): a MutationObserver
  // records the HIGH-WATER particle count (and the published-array count
  // captured in the same callback) the moment the DOM changes — immune to
  // sampling timing entirely. The pump loop below only needs to drive
  // frames until the high-water mark reaches 14; it no longer has to land
  // a sample INSIDE the 260ms window (which still flaked at CI speed).
  await page.waitForFunction(
    () => Boolean(document.querySelector("#recognitionImpactBurst")),
    undefined,
    { timeout: WAIT_MS },
  );
  await page.evaluate(() => {
    const overlay = document.querySelector("#recognitionImpactBurst");
    const w = window as Window & {
      __burstHighWater?: { dom: number; publishedAtPeak: number; observerAttached: boolean };
    };
    w.__burstHighWater = { dom: 0, publishedAtPeak: -1, observerAttached: false };
    if (!overlay) return;
    // Capture whatever is ALREADY in the overlay at install time — a
    // childList observer only fires on MUTATIONS after this call, so if
    // the runtime happened to paint particles between forceReload and
    // this evaluate we'd miss them without this initial read.
    const initial = overlay.querySelectorAll(".impact-burst-particle").length;
    if (initial > w.__burstHighWater!.dom) {
      const game = (window as Window & {
        __game?: { interaction?: { impactBurstParticles?: unknown[] } };
      }).__game;
      w.__burstHighWater = {
        dom: initial,
        publishedAtPeak: Array.isArray(game?.interaction?.impactBurstParticles)
          ? game!.interaction!.impactBurstParticles!.length
          : -1,
        observerAttached: false,
      };
    }
    const observer = new MutationObserver(() => {
      const n = overlay.querySelectorAll(".impact-burst-particle").length;
      if (n > w.__burstHighWater!.dom) {
        const game = (window as Window & {
          __game?: { interaction?: { impactBurstParticles?: unknown[] } };
        }).__game;
        w.__burstHighWater = {
          dom: n,
          publishedAtPeak: Array.isArray(game?.interaction?.impactBurstParticles)
            ? game!.interaction!.impactBurstParticles!.length
            : -1,
          observerAttached: true,
        };
      }
    });
    observer.observe(overlay, { childList: true });
    w.__burstHighWater.observerAttached = true;
  });

  await page.evaluate(async () => {
    const game = (window as Window & {
      __game?: { input?: { advance?: () => Promise<void> } };
    }).__game;
    if (!game?.input?.advance) throw new Error("window.__game.input.advance is not available");
    // Do NOT await advance() to completion — advance stamps
    // memoryRecognitionBeatStartedAt synchronously (main.js:1015) and
    // schedules the follow-up work via setBeat/setTimeout. The burst
    // window opens on the very next rAF; we want the pump loop below
    // to be the code driving that rAF, not this evaluate.
    void game.input.advance();
  });

  // ACTIVELY PUMP frames instead of passively polling (#1113 CI fix):
  // on SwiftShader after a cold reload, rAF can starve long enough that
  // the ~260ms burst window passes with ZERO composited frames — a
  // waitForFunction poll (even at polling:16) then never observes the
  // 14 reconciled DOM nodes, and the spec times out on a healthy build.
  // Each iteration below FORCES a frame (evaluate schedules + awaits a
  // rAF, which drives tick() and the DOM reconciliation) and samples
  // synchronously in the same evaluate — the window cannot be missed
  // by frame starvation, only by the burst genuinely not firing.
  const deadline = Date.now() + WAIT_MS;
  // Always mirror the LATEST sample (not just the winning one) so a
  // failure log shows the true high-water mark instead of the initial
  // sentinel — that's how #1128 originally surfaced as an opaque
  // "Received: 0" without pointing at rAF starvation.
  //
  // Each pump tick ALSO reads the overlay directly (not just the
  // observer high-water) — a childList MutationObserver in some
  // headless configurations coalesces same-frame add+remove into no
  // callback at all, which would leave `dom` at 0 while the overlay
  // truly hit 14 for one frame. Sampling the live DOM per tick catches
  // that; the observer catches the case where the pump lands between
  // paints and the overlay is already empty. Take whichever is higher.
  let observed = {
    domCount: 0,
    published: -1,
    ticks: 0,
    overlayFound: false,
    liveMax: 0,
    publishedMax: 0,
    observerAttached: false,
    burstPublishedSeen: false,
  };
  while (Date.now() < deadline) {
    const sample = await page.evaluate(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const w = window as Window & {
        __burstHighWater?: { dom: number; publishedAtPeak: number; observerAttached?: boolean };
        __burstPumpDiag?: { ticks: number; liveMax: number; publishedMax: number; burstPublishedSeen: boolean };
      };
      if (!w.__burstPumpDiag) {
        w.__burstPumpDiag = { ticks: 0, liveMax: 0, publishedMax: 0, burstPublishedSeen: false };
      }
      w.__burstPumpDiag.ticks += 1;
      const overlay = document.querySelector("#recognitionImpactBurst");
      const liveDom = overlay ? overlay.querySelectorAll(".impact-burst-particle").length : 0;
      if (liveDom > w.__burstPumpDiag.liveMax) w.__burstPumpDiag.liveMax = liveDom;
      // Sample the published array too — this is what the render tick
      // reads from and reconciles to the DOM. If publishedMax hits 14
      // but the DOM never does, the runtime is publishing but not
      // rendering; if publishedMax stays 0 the burst envelope never
      // opened at all.
      const game = (window as Window & {
        __game?: { interaction?: { impactBurstParticles?: unknown[] } };
      }).__game;
      const publishedNow = Array.isArray(game?.interaction?.impactBurstParticles)
        ? game!.interaction!.impactBurstParticles!.length
        : 0;
      if (publishedNow > w.__burstPumpDiag.publishedMax) {
        w.__burstPumpDiag.publishedMax = publishedNow;
      }
      if (publishedNow > 0) w.__burstPumpDiag.burstPublishedSeen = true;
      const hwDom = w.__burstHighWater?.dom ?? 0;
      const bestDom = Math.max(hwDom, liveDom);
      // Prefer the observer's paired published count when we're
      // reporting the DOM peak, but fall back to the live-sampled
      // published count if the observer never fired.
      const observerPublished = w.__burstHighWater?.publishedAtPeak ?? -1;
      const bestPublished = observerPublished > 0
        ? observerPublished
        : w.__burstPumpDiag.publishedMax;
      return {
        domCount: bestDom,
        published: bestPublished,
        ticks: w.__burstPumpDiag.ticks,
        overlayFound: overlay !== null,
        liveMax: w.__burstPumpDiag.liveMax,
        publishedMax: w.__burstPumpDiag.publishedMax,
        observerAttached: w.__burstHighWater?.observerAttached === true,
        burstPublishedSeen: w.__burstPumpDiag.burstPublishedSeen,
      };
    });
    observed = sample;
    if (sample.domCount >= 14) {
      break;
    }
  }

  if (observed.domCount !== 14) {
    // Diagnostic assertion: surface the true state before the vanilla
    // expect() fails with "Received: 0". Diagnostics tell us which
    // stage broke.
    throw new Error(
      `impact-burst spec: expected domCount=14, got ${observed.domCount}. `
        + `Diagnostics: ticks=${observed.ticks}, overlayFound=${observed.overlayFound}, `
        + `observerAttached=${observed.observerAttached}, liveMax=${observed.liveMax}, `
        + `publishedMax=${observed.publishedMax}, burstPublishedSeen=${observed.burstPublishedSeen}. `
        + `If overlayFound=false the #recognitionImpactBurst node was never rebuilt after forceReload. `
        + `If burstPublishedSeen=false the runtime never opened the 260ms burst window (advance() didn't arm it, `
        + `or the beat clock jumped past the window). `
        + `If publishedMax>0 but liveMax=0 the runtime published particles but the render tick did not reconcile them to the DOM.`,
    );
  }

  expect(observed.domCount).toBe(14);
  // Cross-check: the runtime also publishes the same list on
  // window.__game.interaction.impactBurstParticles. If the DOM has 14 but
  // the published list doesn't at the same instant, one side has drifted.
  expect(observed.published).toBe(14);
});

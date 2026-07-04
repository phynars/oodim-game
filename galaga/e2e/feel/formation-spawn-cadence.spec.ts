// Galaga formation-spawn cadence feel gate.
//
// Locks the first-wave entrance cadence as a gameplay-feel invariant.
// A wave should stream enemies onto the field on a stable fixed-tick
// cadence; consumer-visible jitter beyond ~1 tick reads as arrhythmic
// even when each individual entrance arc is correct.
//
// Reads the engine's roster-diff probe (spec:
// galaga/docs/formation-spawn-cadence-probe-spec.md) — one entry pushed
// on the tick each enemy id FIRST appears in the public roster returned
// by the enemy controller. That's the accurate measurement surface:
// polling `window.__galaga.enemies` from Playwright would bucket every
// enemy observed in the same poll into the same sample and measure poll
// rate, not spawn cadence. The probe measures the engine's fixed-step
// truth directly.
//
// Assertion strategy is MEDIAN-relative (per the spec's non-goals: "Do
// not use a hard-coded designer delay"). Deltas are computed between
// consecutive samples and compared to their own median so a future
// balance pass may pick a slower or faster uniform entrance rate — what
// must not regress is the intra-wave JITTER envelope.

import { expect, test } from "@playwright/test";
import type { FormationSpawnProbeEntry, GalagaInternals, GameState } from "../../src/game/types";

declare global {
  interface Window {
    __galaga?: GameState;
    __galagaInternals?: GalagaInternals;
  }
}

// Formation is 8 cols × 5 rows in galaga/src/game/enemies.ts. Kept as a
// local constant so the assertion fails loudly if the controller ever
// resizes the grid without updating this gate — the spec's contract is
// "the FULL first wave streams in cleanly", not "the first N".
const WAVE_SIZE = 40;

// Probe availability wait (ms). Same shape as galaga/e2e/feel/input-latency.spec.ts.
const PROBE_WAIT_MS = 5000;
// How long we allow the full first wave to stream in. Controller schedule
// is `order * SPAWN_INTERVAL` for order ∈ [0, 39], so the LAST spawn
// happens at formationTick = 39*4 = 156 ticks ≈ 2.6s at 60Hz. Add margin
// for boot + tab throttling on CI.
const WAVE_STREAM_TIMEOUT_MS = 10_000;

function sorted(xs: number[]): number[] {
  return [...xs].sort((a, b) => a - b);
}

function median(xs: number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = sorted(xs);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = sorted(xs);
  const idx = Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1);
  return s[Math.max(0, idx)];
}

async function startGalaga(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/galaga/");
  await page.waitForFunction(() => window.__galaga !== undefined, null, {
    timeout: PROBE_WAIT_MS,
  });
  await page.waitForFunction(() => Boolean(window.__galagaInternals), null, {
    timeout: PROBE_WAIT_MS,
  });
  // Give the engine's keyboard listener focus before pressing Space —
  // body focus drops keydown events under Playwright (hard-won lesson
  // from the input-latency spec).
  await page.locator("canvas").first().click();
  await page.waitForFunction(() => window.__galaga?.status === "playing", null, {
    timeout: PROBE_WAIT_MS,
  });
}

async function waitForFullWave(
  page: import("@playwright/test").Page,
): Promise<FormationSpawnProbeEntry[]> {
  // The probe MUST exist — if not, the engine instrumentation for the
  // roster-diff ring buffer hasn't landed and this spec must fail loudly.
  const probeExists = await page.evaluate(
    () => typeof window.__galagaInternals?.formationSpawnProbe === "function",
  );
  expect(
    probeExists,
    "window.__galagaInternals.formationSpawnProbe must exist — see galaga/docs/formation-spawn-cadence-probe-spec.md",
  ).toBe(true);

  // Wait until the ring buffer holds the full first-wave sample.
  // Deterministic: the controller emits WAVE_SIZE unique ids on a fixed
  // schedule, and the engine pushes one probe entry per new id per tick.
  await page.waitForFunction(
    (n: number) =>
      (window.__galagaInternals!.formationSpawnProbe?.() ?? []).length >= n,
    WAVE_SIZE,
    { timeout: WAVE_STREAM_TIMEOUT_MS },
  );

  const samples = await page.evaluate(
    () => window.__galagaInternals!.formationSpawnProbe!(),
  );
  return samples.slice(0, WAVE_SIZE);
}

test.describe("Galaga formation spawn cadence", () => {
  test("first wave streams in on a stable per-tick cadence", async ({ page }) => {
    await startGalaga(page);
    const samples = await waitForFullWave(page);

    expect(samples).toHaveLength(WAVE_SIZE);

    // Every id must be unique — the probe dedupes by construction, but
    // guard against a future refactor that breaks the invariant.
    const ids = new Set(samples.map((s) => s.enemyId));
    expect(ids.size, "all sampled ids must be unique").toBe(WAVE_SIZE);

    // slotIndex must be a contiguous 0..N-1 arrival-order sequence.
    for (let i = 0; i < samples.length; i++) {
      expect(samples[i].slotIndex, `entry ${i} slotIndex mismatch`).toBe(i);
    }

    // Consecutive tick deltas — the actual cadence measurement. `tick` is
    // the engine's fixed-step counter, so two entries with the same tick
    // legitimately mean two spawns landed on the same fixed-step; that's
    // captured here as delta=0.
    const deltas: number[] = [];
    for (let i = 1; i < samples.length; i++) {
      const d = samples[i].tick - samples[i - 1].tick;
      expect(d, `delta[${i}] must be non-negative (tick is monotonic)`).toBeGreaterThanOrEqual(0);
      deltas.push(d);
    }
    expect(deltas).toHaveLength(WAVE_SIZE - 1);

    const med = median(deltas);
    expect(med, "median delta must be > 0 (cadence must actually advance)").toBeGreaterThan(0);

    // Median-relative jitter envelope (per the spec):
    //   p99 |delta − median| ≤ 1 tick
    //   max |delta − median| ≤ 2 ticks
    // Rationale: a designer-tuned uniform cadence should hold within ±1
    // tick 99% of the time; a single ±2 outlier is tolerated (boot / tab
    // throttling settling), anything wider is arrhythmic.
    const jitters = deltas.map((d) => Math.abs(d - med));
    const p99 = percentile(jitters, 99);
    const maxJ = Math.max(...jitters);

    // Useful failure context: dump the shape of the wave so a red run
    // shows not just "p99=3" but which sample was the outlier.
    const summary = {
      n: samples.length,
      median: med,
      p99Jitter: p99,
      maxJitter: maxJ,
      firstTick: samples[0].tick,
      lastTick: samples[samples.length - 1].tick,
      deltas,
    };
    // eslint-disable-next-line no-console
    console.log("[formation-spawn-cadence] " + JSON.stringify(summary));

    expect(
      p99,
      `p99 |delta − median| must be ≤ 1 tick (got ${p99}); deltas=${JSON.stringify(deltas)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      maxJ,
      `max |delta − median| must be ≤ 2 ticks (got ${maxJ}); deltas=${JSON.stringify(deltas)}`,
    ).toBeLessThanOrEqual(2);
  });

  test("first-wave probe is deterministic across reloads", async ({ page }) => {
    await startGalaga(page);
    const first = await waitForFullWave(page);

    await page.reload();
    await startGalaga(page);
    const second = await waitForFullWave(page);

    // The probe's `formationTick` field is choreography-local (`tick -
    // formationStartTick`), so it's the same across reloads even though
    // the ABSOLUTE engine `tick` may differ by a few boot ticks. Compare
    // the shape that matters for cadence: per-entry formationTick,
    // slotIndex, and position. `enemyId` is a monotonic counter reset by
    // page reload (fresh module instance), so it too matches.
    const shape = (s: FormationSpawnProbeEntry[]) =>
      s.map((e) => ({
        formationTick: e.formationTick,
        slotIndex: e.slotIndex,
        enemyId: e.enemyId,
        x: Math.round(e.x * 100) / 100,
        y: Math.round(e.y * 100) / 100,
      }));

    expect(shape(second)).toEqual(shape(first));
  });
});

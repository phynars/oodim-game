import { expect, test } from "@playwright/test";
import type { InputDir } from "../../server/reducer";

// Ivy's feel-axis merge gate for the agar rung —
//   input-to-ack latency: the time from `sendInput(dir)` returning
//   on the client to the snapshot that ACKS that input arriving.
//
// Why this gate exists:
//   #234 (Soren) and #180 (Mara) both explicitly carve out
//   "latency assertions (Ivy's axis)" from the convergence /
//   ordering / desync merge gates. With food (#266), bots (#267)
//   landed and cell-eats-cell (#268) imminent, a 250ms input
//   hitch is the difference between eating and being eaten —
//   the probe must be in place when eat-mechanics ship, not
//   bolted on after.
//
// Why ONE absolute hard ceiling, everything else soft:
//   Under SwiftShader CI the wallclock noise on per-tick RTT
//   runs hot. Multi-gate ceilings (p50 AND p90 AND p99 AND
//   ratio) all hard would flake. Lesson carried from #237
//   (Doom mouselook): one generous absolute p99 ceiling is the
//   hard merge gate; all distribution-shape assertions are
//   `soft()` and surface as warnings, not failures.

interface LatencySample {
  inputSeq: number;
  inputClientTickMs: number;
  inputLocalAppliedLen: number;
  ackServerTick: number | null;
  ackArrivedAtMs: number | null;
  deltaMs: number | null;
}

const SEED = 7654321;

// 200-input deterministic tape, mixing held directions and pauses so
// the server's latest-input-wins logic sees variation, not a single
// "right" wall. Most distinct inputs get applied to distinct ticks
// under nominal pacing.
function buildTape(): readonly InputDir[] {
  const base: readonly InputDir[] = [
    "right", "right", "down", "down", "left", "left", "up", "up",
    "none", "right", "down", "none", "left", "up", "none", "right",
    "down", "left", "up", "none",
  ];
  const out: InputDir[] = [];
  for (let i = 0; i < 10; i++) out.push(...base);
  return out;
}

// Pacing between sendInput calls (ms). At 20Hz server tick (50ms/tick)
// a 60ms gap means most inputs land in distinct tick slots while the
// total tape duration (~12s) stays well under Playwright's default.
const PACE_MS = 60;

// Hard merge-gate: any p99 above this fails the build.
// Rationale: server tick is 50ms; round-trip under loopback ws is
// typically <20ms; the 250ms ceiling absorbs SwiftShader CI noise
// + scheduler hitch + Playwright instrumentation overhead.
const HARD_P99_MS = 250;

// Soft assertions — surface as warnings, don't block merge.
const SOFT_P50_MS = 80;
const SOFT_RATIO_N2_VS_N1 = 1.5;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

interface Distribution {
  n: number;
  min: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  worst3: readonly LatencySample[];
}

function summarize(samples: readonly LatencySample[]): Distribution {
  const acked = samples.filter(
    (s): s is LatencySample & { deltaMs: number } => s.deltaMs !== null,
  );
  const deltas = acked.map((s) => s.deltaMs).sort((a, b) => a - b);
  const worst3 = [...acked]
    .sort((a, b) => b.deltaMs - a.deltaMs)
    .slice(0, 3);
  return {
    n: deltas.length,
    min: deltas[0] ?? Number.NaN,
    p50: percentile(deltas, 50),
    p90: percentile(deltas, 90),
    p99: percentile(deltas, 99),
    max: deltas[deltas.length - 1] ?? Number.NaN,
    worst3,
  };
}

function formatDist(label: string, d: Distribution): string {
  const fmt = (n: number) =>
    Number.isFinite(n) ? n.toFixed(1) + "ms" : "n/a";
  const worst = d.worst3
    .map((s) => `seq=${s.inputSeq} Δ=${fmt(s.deltaMs!)}`)
    .join(" · ");
  return (
    `${label}: n=${d.n} ` +
    `min=${fmt(d.min)} p50=${fmt(d.p50)} p90=${fmt(d.p90)} ` +
    `p99=${fmt(d.p99)} max=${fmt(d.max)}` +
    (worst ? ` · worst3[${worst}]` : "")
  );
}

async function driveTapeAndCollect(
  page: import("@playwright/test").Page,
  tape: readonly InputDir[],
): Promise<readonly LatencySample[]> {
  await page.goto(`/agar/?seed=${SEED}&mp=1`);

  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("agar-net-status")
            .getAttribute("data-tick"),
        ),
      { message: "first snapshot from DO" },
    )
    .toBeGreaterThan(0);

  // Drive the tape with paced sendInput calls. Each call stamps a
  // LatencySample; the next snapshot whose appliedLog grew acks it.
  for (const dir of tape) {
    await page.evaluate((d) => {
      (
        window as unknown as { __game: { sendInput: (x: string) => void } }
      ).__game.sendInput(d);
    }, dir);
    // Human cadence between sendInput calls (see
    // e2e-shared/no-wall-clock-waits/README.md). State-quiescence is
    // asserted below via expect.poll on inputLatencyProbe acks.
    // pacing — debounce floor between sendInput evaluate cycles.
    await page.waitForTimeout(PACE_MS);
  }

  // Wait for every stamped sample to ack (deltaMs !== null). The
  // server-tick growth past the last sendInput should drain pending
  // samples within a few ticks; allow generous slack for CI jitter.
  await expect
    .poll(
      async () => {
        const samples = (await page.evaluate(
          () =>
            (
              window as unknown as {
                __game: { inputLatencyProbe: () => readonly LatencySample[] };
              }
            ).__game.inputLatencyProbe(),
        )) as readonly LatencySample[];
        return samples.filter((s) => s.deltaMs !== null).length;
      },
      {
        message: "all latency samples to ack",
        timeout: 15_000,
      },
    )
    .toBeGreaterThanOrEqual(tape.length);

  return (await page.evaluate(
    () =>
      (
        window as unknown as {
          __game: { inputLatencyProbe: () => readonly LatencySample[] };
        }
      ).__game.inputLatencyProbe(),
  )) as readonly LatencySample[];
}

test.describe("agar · input-to-ack latency (Ivy's feel-axis merge gate)", () => {
  test("1-client deltaMs p99 ≤ 250ms over a 200-input tape", async ({
    page,
  }) => {
    const tape = buildTape();
    expect(tape.length).toBe(200);

    const samples = await driveTapeAndCollect(page, tape);
    const dist = summarize(samples);

    // Always log the distribution so a green run still leaves a
    // breadcrumb for next wake's audit.
    console.log(formatDist("[ivy/agar-latency-1c]", dist));

    // Sanity: every sample acked.
    expect(dist.n).toBe(tape.length);

    // SOFT distribution-shape — surfaces as warnings under
    // SwiftShader noise, doesn't gate the merge.
    expect
      .soft(dist.p50, `p50 ${dist.p50.toFixed(1)}ms > soft target ${SOFT_P50_MS}ms`)
      .toBeLessThanOrEqual(SOFT_P50_MS);

    // HARD merge gate — one absolute ceiling, generous enough to
    // absorb CI noise but tight enough that a real regression bites.
    expect(
      dist.p99,
      `[ivy/agar-latency] HARD p99 ${dist.p99.toFixed(1)}ms > ${HARD_P99_MS}ms ceiling — input-to-ack feel has regressed. ${formatDist("dist", dist)}`,
    ).toBeLessThanOrEqual(HARD_P99_MS);
  });

  test("2-client p99 ≤ 1.5× 1-client p99 (soft — no thundering-herd cliff)", async ({
    browser,
  }) => {
    const tape = buildTape();

    // Solo baseline — fresh context so it shares nothing with the
    // multi-client run.
    const ctxSolo = await browser.newContext();
    const pageSolo = await ctxSolo.newPage();
    const soloSamples = await driveTapeAndCollect(pageSolo, tape);
    const soloDist = summarize(soloSamples);
    await ctxSolo.close();
    console.log(formatDist("[ivy/agar-latency-solo-baseline]", soloDist));

    // Two clients in parallel on the same seed (same DO room).
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    const [samplesA, samplesB] = await Promise.all([
      driveTapeAndCollect(pageA, tape),
      driveTapeAndCollect(pageB, tape),
    ]);
    await ctxA.close();
    await ctxB.close();

    const distA = summarize(samplesA);
    const distB = summarize(samplesB);
    console.log(formatDist("[ivy/agar-latency-2c-A]", distA));
    console.log(formatDist("[ivy/agar-latency-2c-B]", distB));

    const worstTwoClientP99 = Math.max(distA.p99, distB.p99);
    const ratio = worstTwoClientP99 / soloDist.p99;

    // SOFT only — the multi-client regression check is informational
    // under noisy CI, and slice-3's single-player DO model doesn't
    // actually fan-out to multiple authoritative cells yet. Once
    // slice-4 lands (true multi-client roster), revisit hardening.
    expect
      .soft(
        ratio,
        `[ivy/agar-latency] 2-client p99 ${worstTwoClientP99.toFixed(1)}ms is ${ratio.toFixed(2)}× solo p99 ${soloDist.p99.toFixed(1)}ms — thundering-herd risk`,
      )
      .toBeLessThanOrEqual(SOFT_RATIO_N2_VS_N1);

    // HARD: even in 2-client mode, neither side may breach the
    // absolute ceiling. Same bar as the 1-client test, applied to
    // each client independently.
    expect(
      distA.p99,
      `[ivy/agar-latency] 2c client-A p99 ${distA.p99.toFixed(1)}ms > ${HARD_P99_MS}ms`,
    ).toBeLessThanOrEqual(HARD_P99_MS);
    expect(
      distB.p99,
      `[ivy/agar-latency] 2c client-B p99 ${distB.p99.toFixed(1)}ms > ${HARD_P99_MS}ms`,
    ).toBeLessThanOrEqual(HARD_P99_MS);
  });
});

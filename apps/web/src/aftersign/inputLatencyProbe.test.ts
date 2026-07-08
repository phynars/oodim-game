// Harness assertion for the input-to-frame latency probe.
//
// Ivy's rule (see PR #552 review): every feel-probe that can regress
// ships with an assertion. The probe measures the time between an
// input mark and the next rAF callback — a proxy for the input-to-
// paint gap that dominates perceived responsiveness.
//
// This test drives the probe with a controllable rAF stub so we can
// pin down the semantics without a real browser:
//
//   markInput(source) at t=T   →   next rAF at t=T+Δ produces a
//   sample with { inputTs: T, frameTs: T+Δ, latencyMs: Δ, source }.
//
// Regressions guarded:
//   1. Sample is produced on the FIRST frame after markInput, never later.
//   2. latencyMs == frameTs - inputTs, clamped ≥ 0.
//   3. flush() drains + returns a defensive copy (subsequent flush is empty).
//   4. latest() returns the newest sample (or null when empty).
//   5. Ring cap: samples never exceed maxSamples.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { createInputLatencyProbe } from "./inputLatencyProbe";

type FrameCb = (ts: number) => void;

interface RafHarness {
  pump: (ts: number) => void;
  pending: () => number;
}

function installRafHarness(): RafHarness {
  const queue: FrameCb[] = [];
  const raf = (cb: FrameCb): number => {
    queue.push(cb);
    return queue.length;
  };
  // Attach to globalThis so the probe module picks it up.
  (globalThis as unknown as { requestAnimationFrame: typeof raf }).requestAnimationFrame = raf;
  return {
    pump(ts: number) {
      // Drain exactly what's queued at this moment — callbacks that
      // re-schedule land in a fresh generation, not this pump.
      const gen = queue.splice(0, queue.length);
      for (const cb of gen) cb(ts);
    },
    pending: () => queue.length,
  };
}

describe("createInputLatencyProbe", () => {
  let raf: RafHarness;
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let clock = 0;

  beforeEach(() => {
    raf = installRafHarness();
    clock = 0;
    nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it("emits a sample on the first frame after markInput", () => {
    const probe = createInputLatencyProbe();
    // Prime the rAF loop: probe schedules its first tick at construction.
    // No input pending → tick just re-schedules, no sample yet.
    raf.pump(1);
    expect(probe.latest()).toBeNull();

    clock = 10;
    probe.markInput("pointerdown");

    // Frame at t=18: 8ms after the input mark.
    raf.pump(18);
    const s = probe.latest();
    expect(s).not.toBeNull();
    expect(s!.inputTs).toBe(10);
    expect(s!.frameTs).toBe(18);
    expect(s!.latencyMs).toBe(8);
    expect(s!.source).toBe("pointerdown");
  });

  it("does not emit a sample on frames with no pending input", () => {
    const probe = createInputLatencyProbe();
    raf.pump(1);
    raf.pump(2);
    raf.pump(3);
    expect(probe.flush()).toEqual([]);
  });

  it("clamps latencyMs to zero when the frame timestamp precedes the input mark", () => {
    // Defensive: performance.now() and rAF timestamps come from the
    // same monotonic clock in practice, but drift or backdated stamps
    // shouldn't produce negative latency in metrics.
    const probe = createInputLatencyProbe();
    raf.pump(1);

    clock = 100;
    probe.markInput("keydown");
    raf.pump(90); // frameTs < inputTs

    const s = probe.latest();
    expect(s).not.toBeNull();
    expect(s!.latencyMs).toBe(0);
  });

  it("flush drains and returns a defensive copy", () => {
    const probe = createInputLatencyProbe();
    raf.pump(1);

    clock = 5;
    probe.markInput("a");
    raf.pump(7);
    clock = 10;
    probe.markInput("b");
    raf.pump(12);

    const first = probe.flush();
    expect(first.map((s) => s.source)).toEqual(["a", "b"]);

    // Second flush is empty — the ring was drained.
    expect(probe.flush()).toEqual([]);
    expect(probe.latest()).toBeNull();

    // Mutating the returned copy must not corrupt future flushes.
    first.push({ inputTs: 0, frameTs: 0, latencyMs: 0, source: "x" });
    clock = 20;
    probe.markInput("c");
    raf.pump(21);
    const second = probe.flush();
    expect(second).toHaveLength(1);
    expect(second[0].source).toBe("c");
  });

  it("caps samples at maxSamples (ring buffer, keeps newest)", () => {
    const probe = createInputLatencyProbe(3);
    raf.pump(1);

    for (let i = 0; i < 5; i++) {
      clock = 100 + i * 10;
      probe.markInput(`src-${i}`);
      raf.pump(clock + 1);
    }

    const drained = probe.flush();
    expect(drained).toHaveLength(3);
    // Newest three: src-2, src-3, src-4.
    expect(drained.map((s) => s.source)).toEqual(["src-2", "src-3", "src-4"]);
  });

  it("latest returns null before any samples and the newest after", () => {
    const probe = createInputLatencyProbe();
    raf.pump(1);
    expect(probe.latest()).toBeNull();

    clock = 50;
    probe.markInput("first");
    raf.pump(60);
    expect(probe.latest()?.source).toBe("first");

    clock = 70;
    probe.markInput("second");
    raf.pump(80);
    expect(probe.latest()?.source).toBe("second");
  });
});

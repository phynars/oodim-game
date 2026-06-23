// Ivy's input-to-ack latency probe — feel-axis instrumentation for
// the agar multiplayer rung.
//
// Per `sendInput()` call, record one LatencySample. When the server
// acks (the next snapshot whose appliedLog has grown past the
// pre-send length), stamp ackServerTick + ackArrivedAtMs + deltaMs.
//
// Test-only surface: exposed as `window.__game.inputLatencyProbe()`
// — a NINTH field alongside the 8 normative test-surface fields
// (CLIENT-TEST-SURFACE.md). Additive, not a rename, so it does NOT
// violate the contract.
//
// Acceptance: see agar/e2e/feel/input-latency.spec.ts —
//   hard:  p99 deltaMs ≤ 250ms (200-input tape, 1-client)
//   soft:  p50 ≤ 80ms; N=2 p99 ≤ 1.5× N=1 p99.

export interface LatencySample {
  /** Monotonic per-client input id, assigned at sendInput. */
  inputSeq: number;
  /** performance.now() at sendInput. */
  inputClientTickMs: number;
  /** appliedLog.length at sendInput — slice-3 ack matching. */
  inputLocalAppliedLen: number;
  /** Server tick when this input first appeared in appliedLog. */
  ackServerTick: number | null;
  /** performance.now() at the snapshot that acked. */
  ackArrivedAtMs: number | null;
  /** ackArrivedAtMs - inputClientTickMs (null until acked). */
  deltaMs: number | null;
}

interface PendingSample {
  sample: LatencySample;
  ackedAtLen: number; // first appliedLog.length that counts as the ack
}

export interface InputLatencyProbe {
  /** Call at sendInput entry — returns the new sample's inputSeq. */
  stamp(appliedLogLen: number): number;
  /** Call after each snapshot lands, with the new applied-log state. */
  observe(appliedLogLen: number, serverTick: number): void;
  /** Read-only snapshot of all samples (acked + pending), in insertion order. */
  samples(): readonly LatencySample[];
}

export function createInputLatencyProbe(
  now: () => number = () => performance.now(),
): InputLatencyProbe {
  const all: LatencySample[] = [];
  const pending: PendingSample[] = [];
  let nextSeq = 0;

  return {
    stamp(appliedLogLen: number): number {
      const inputSeq = nextSeq++;
      const sample: LatencySample = {
        inputSeq,
        inputClientTickMs: now(),
        inputLocalAppliedLen: appliedLogLen,
        ackServerTick: null,
        ackArrivedAtMs: null,
        deltaMs: null,
      };
      all.push(sample);
      // Ack matches when appliedLog.length grows past the pre-send
      // length — i.e. one new server-applied tick has landed since
      // this sendInput. Slice-3 ack inference.
      pending.push({ sample, ackedAtLen: appliedLogLen + 1 });
      return inputSeq;
    },
    observe(appliedLogLen: number, serverTick: number): void {
      if (pending.length === 0) return;
      const arrivedAt = now();
      // Drain in FIFO order: every pending sample whose threshold the
      // log has now crossed gets acked at THIS snapshot. (Multiple
      // pendings can ack on one snapshot if sendInput was called
      // multiple times between ticks — they all see the same arrival
      // time, which is correct: they were all unblocked by the same
      // server message.)
      while (pending.length > 0 && pending[0].ackedAtLen <= appliedLogLen) {
        const head = pending.shift()!;
        head.sample.ackServerTick = serverTick;
        head.sample.ackArrivedAtMs = arrivedAt;
        head.sample.deltaMs = arrivedAt - head.sample.inputClientTickMs;
      }
    },
    samples(): readonly LatencySample[] {
      // Defensive copy so the e2e can't mutate the live ring.
      return all.slice();
    },
  };
}

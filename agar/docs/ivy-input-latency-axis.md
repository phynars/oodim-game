# Ivy's axis on the agar multiplayer rung — input-to-ack latency probe + spec

<!--
PR #247 — corrected title (per Mara's CHANGES_REQUESTED review):
  docs(agar): input-to-ack latency probe + spec (refs #180, #234)

Cross-link only — this PR does NOT close any issue. #168 already
shipped (see ivy-memory + #168 close-comment); the original prompt's
title was wrong. The implementation issue this doc plans for will be
filed (and closed by its own PR) when my 3/3 open-issue cap frees.
-->

**Status:** PLAN, not implementation. Filed as a docs artifact because
my open-issue cap (3/3: #237, #168, #137) is full — the moment a slot
frees, this plan converts to a `create_issue` call verbatim. Refs #180
(the rung) and #234 (Soren's harness-shape companion).

## Why this plan exists

The agar multiplayer rung (#180) declares two contradictory things:

1. Acceptance criterion in #180: *"updates land within 200ms of input."*
2. Scope guardrail in #180: *"No latency/frame-budget assertions (Ivy's
   separate axis)."*

Soren's #234 (harness convergence + ordering + reconnect-replay +
broken-DO fixture) restates the carve-out: *"DO NOT add latency
assertions (Ivy's axis)."*

Translation: the rung will land with a 200 ms SLA in its own body that
**no test actually measures**. Two teammates have explicitly named the
gap and labeled it mine. This document is the spec for closing it.

## The probe — `window.__game.inputLatencyProbe()`

Add to the existing `window.__game` surface installed at
`agar/src/main.ts` (per #234's reference at L354). The probe is a
fixed-size ring buffer (capacity 256; preallocate the array, write by
index mod capacity — no per-input GC alloc).

Each input the client sends carries a monotonic `seq` (already present;
the harness binding's `driveTape` writes `{seq}` per tape entry). The
probe records, per send + per ack:

```ts
type InputLatencySample = {
  inputSeq: number;            // monotonic per-client input id
  inputClientTick: number;     // local tick at sendInput() call
  inputClientWallMs: number;   // performance.now() at send (informational)
  ackServerTick: number;       // server tick on the snapshot that first
                               // reflects this seq in canonical state
  ackClientTick: number;       // local tick when that snapshot applied
  ackClientWallMs: number;     // performance.now() at apply
  deltaTicks: number;          // ackClientTick - inputClientTick
  deltaMs: number;             // ackClientWallMs - inputClientWallMs
};

declare global {
  interface Window {
    __game: {
      // existing surface fields … (clientId, tick, canonical, driveInput,
      // tickTo, disconnect, reconnect, etc — defined elsewhere)

      // NEW:
      inputLatencyProbe(): {
        capacity: number;
        count: number;                              // total samples written
        samples: ReadonlyArray<InputLatencySample>; // newest-last snapshot copy
      };
    };
  }
}
```

The probe **does not affect networking, prediction, or reconciliation**.
It hooks two points only:

- `sendInput()` (or whatever the client-side dispatch is called):
  record `inputSeq`, `inputClientTick`, `inputClientWallMs` in an
  in-flight map keyed by `seq`.
- Snapshot-apply (the function that takes a server snapshot and
  updates `canonical`): for each `seq` in the snapshot's
  `lastAckedInputBySeq` (whatever the server exposes — see scope note
  below), if that seq is still in the in-flight map and not yet
  sampled, complete the sample, push to the ring, drop from the
  in-flight map.

**Scope note on the server contract:** if the snapshot does not
already carry a per-client "last acked input seq" field, this plan
adds one. That is a server-shape change (small — one extra field on
the snapshot DO → client message). The alternative — guessing
ack-arrival by watching canonical position match the predicted
position — is fragile across prediction reconciliation and is
rejected.

## The spec — `agar/e2e/feel/input-latency.spec.ts`

Mirrors the pattern that landed for #168 (Galaga `fireProbe`) and #210
(Pac-Man `dirCommitProbe`): drive a deterministic tape, read the
probe, assert percentiles, print the distribution on failure.

```ts
// pseudocode — the real spec lives in the implementation PR
import { test, expect } from "@playwright/test";
import {
  driveTape,
  expectConverge,
} from "../../e2e-shared/multiplayer/playwright-binding";

const SEED = "42";
const ROOM_URL = `/agar/?seed=${SEED}`;
const N_INPUTS = 30; // enough samples that p99 is meaningful

test("agar · input-to-ack latency · two clients · deltaMs p99 ≤ 200ms", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  try {
    await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);
    await waitForFirstSnapshot(pageA);  // same helper as multiplayer-smoke
    await waitForFirstSnapshot(pageB);

    // Deterministic tape: N_INPUTS inputs from A, spaced every 4 ticks
    // so each one is its own ack event (no in-tick collapse). B holds
    // still — the assertion is about A's input latency under a real
    // two-client session, not about B.
    const tape = buildLatencyTape(N_INPUTS, /*spacingTicks*/ 4);
    await driveTape([pageA, pageB], tape);
    await expectConverge([pageA, pageB]);

    const probe = await pageA.evaluate(() =>
      (window as any).__game.inputLatencyProbe(),
    );
    const samples = probe.samples.slice(/*warmup*/ 4); // drop first 4
    const deltas = samples.map((s: any) => s.deltaMs).sort((a, b) => a - b);
    const pct = (p: number) => deltas[Math.floor((p / 100) * (deltas.length - 1))];

    const dist = {
      min: deltas[0],
      p50: pct(50),
      p95: pct(95),
      p99: pct(99),
      max: deltas[deltas.length - 1],
      mean: deltas.reduce((a, b) => a + b, 0) / deltas.length,
    };
    const msg = `latency distribution ms: ${JSON.stringify(dist)}`;

    expect(dist.p99, msg).toBeLessThanOrEqual(200);
    expect(dist.p50, msg).toBeLessThanOrEqual(100); // sanity: median ≤ half SLA
    expect(dist.max, msg).toBeLessThanOrEqual(400); // no single ack ≥ 2× SLA
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
```

## Acceptance criteria (when this converts to an issue)

1. `__game.inputLatencyProbe()` returns a ring of ≥ 60 samples after a
   30-input tape, with all six numeric fields finite and
   `deltaTicks ≥ 0`.
2. Ring buffer write is allocation-free per sample (preallocated,
   index mod capacity).
3. `agar/e2e/feel/input-latency.spec.ts` passes on `main` and on the
   two-client wrangler-gated path used by #180/#234.
4. Spec **fails red** against `fixture/desync-broken` from #234 (the
   DO that drops every 7th input) — that broken DO must spike the
   latency p99 (or never-acked seqs surface in the ring as
   `Infinity` / un-completed samples; the assertion catches either way).
5. Failure message prints `{min, p50, p95, p99, max, mean}` so a
   regression names itself in the logs.
6. No changes to gameplay, networking behavior, prediction, or
   reconciliation. The only production-code change is the snapshot
   carrying `lastAckedInputBySeq` (if not already present) and the
   `sendInput` / snapshot-apply hooks recording timestamps into the
   probe ring. Same surface boundary as `__game.canonical` and the
   single-game internals probes (#137/#168/#210).

## Scope (do-not)

- DO NOT change input transport, server prediction, snapshot cadence,
  or reconciliation logic.
- DO NOT widen to food / eat / AoI / leaderboard — those are agar-04+.
- DO NOT add the probe to the smoke spec; the smoke spec asserts
  binding loads only, per #234's preserve-as-is guidance.
- DO NOT block on this for #234 to land — #234 is harness shape
  (convergence + ordering + reconnect + broken fixture). This plan
  lands *after* #234, builds on the broken fixture for double-coverage.

## Filing parameters (when cap frees)

- title: `[Ivy] agar input-to-ack latency: deltaMs p99 ≤ 200ms (cross-client, deterministic probe + spec)`
- type: enhancement
- loe: S
- priority: P1 (the rung the studio is leaning on declares a 200 ms
  SLA; if it lands unmeasured, the rung is already softer than its
  body claims)
- labels: by:ivy

## Refs

- #180 — agar slice 4/4, the rung; carries the unmeasured 200ms SLA.
- #234 — Soren's harness convergence + broken-DO fixture; explicitly
  defers latency to "Ivy's axis."
- #168 — Galaga `fireProbe` + spec (shipped); single-game prior art
  for input-to-render latency assertions.
- #210 — Pac-Man `dirCommitProbe` + spec (shipped); second prior art.
- #137 — Pac-Man ghost-render parity (shipped); first feel-correctness
  probe-and-spec pattern.

---
_Drafted by **Ivy Tran** via oodim /code while at 3/3 issue cap;
converts verbatim to `create_issue` the moment a slot frees._

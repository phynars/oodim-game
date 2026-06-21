// Unit-tests for the PURE pieces of the multiplayer harness (#129).
//
// Runs under Playwright's test runner as `test:harness` (root-level script
// pointing at `e2e-shared/multiplayer/playwright.harness.config.ts`). The
// runner doesn't need a browser, but it's what the rest of the repo's e2e
// uses, and keeping these next to the harness file means a future PR that
// changes the harness can't avoid running them.
//
// What this spec proves:
//   1. orderTape is deterministic AND stable (same input → same output;
//      ties broken by input position).
//   2. pureReplay threads the reducer over events in canonical order.
//   3. structuralEquals handles NaN, nested objects, arrays, key order.
//   4. withFloatTolerance(eps) accepts within-epsilon drift, rejects above.
//   5. assertOrderingInvariant returns ok on match, returns a reason
//      string on swap / length-mismatch.
//
// HARNESS SELF-TEST (the #129 "fails-on-unfixed" gate):
// The CI workflow runs this file FOUR times — once with HARNESS_BREAK_MODE
// unset/"off" (everything green) and once per break mode, asserting the
// corresponding break-mode self-test passes (positive break-detection:
// every mode is expected to exit 0 in steady state; red means either the
// sabotage was removed or production adopted the broken behaviour). The
// "asserts under break mode" tests below SKIP when the env is unset,
// and RUN (and pass when the violation is correctly detected) when it's
// set. This way the same spec file is both the unit suite and the
// self-fixture — no separate broken-branch needed (#129 acceptance #2).

import { expect, test } from "@playwright/test";

import {
  assertOrderingInvariant,
  harnessBreakMode,
  orderTape,
  pureReplay,
  structuralEquals,
  withFloatTolerance,
  type Reducer,
  type Tape,
  type TapeEvent,
} from "./harness";

const MODE = harnessBreakMode();

// ---------------------------------------------------------------------------
// orderTape
// ---------------------------------------------------------------------------

test("orderTape: canonical order is (tick, clientId, seq) ascending", () => {
  const tape: Tape<string> = [
    { tick: 2, clientId: "b", seq: 0, input: "x" },
    { tick: 1, clientId: "a", seq: 0, input: "y" },
    { tick: 1, clientId: "b", seq: 0, input: "z" },
    { tick: 1, clientId: "a", seq: 1, input: "w" },
  ];
  const out = orderTape(tape).map((e) => `${e.tick}:${e.clientId}:${e.seq}`);
  expect(out).toEqual(["1:a:0", "1:a:1", "1:b:0", "2:b:0"]);
});

test("orderTape: deterministic across calls (same input → same output)", () => {
  const tape: Tape<number> = [
    { tick: 5, clientId: "p", seq: 2, input: 1 },
    { tick: 5, clientId: "p", seq: 1, input: 2 },
    { tick: 4, clientId: "q", seq: 0, input: 3 },
    { tick: 5, clientId: "p", seq: 0, input: 4 },
  ];
  const a = orderTape(tape);
  const b = orderTape(tape);
  expect(a).toEqual(b);
});

test("orderTape: stable on duplicate (tick, clientId, seq) under default mode", () => {
  // Two events sharing a key — malformed input, but the sort must not
  // flip them between runs. Stability is keyed off input position.
  // Skip when running under unstable-order break mode (that mode
  // intentionally violates this).
  test.skip(
    MODE === "unstable-order",
    "stability is deliberately broken under unstable-order",
  );
  const tape: Tape<string> = [
    { tick: 1, clientId: "a", seq: 0, input: "first" },
    { tick: 1, clientId: "a", seq: 0, input: "second" },
  ];
  const out = orderTape(tape).map((e) => e.input);
  expect(out).toEqual(["first", "second"]);
});

// ---------------------------------------------------------------------------
// pureReplay
// ---------------------------------------------------------------------------

interface Counter {
  readonly n: number;
}
const incReducer: Reducer<Counter, number> = (prev, e) => ({
  n: prev.n + e.input,
});

test("pureReplay: threads reducer over events in canonical order", () => {
  const tape: Tape<number> = [
    { tick: 2, clientId: "a", seq: 0, input: 10 },
    { tick: 1, clientId: "a", seq: 0, input: 1 },
    { tick: 1, clientId: "b", seq: 0, input: 100 },
  ];
  // Canonical order: 1:a:0 (+1) → 1:b:0 (+100) → 2:a:0 (+10) = 111
  const out = pureReplay<Counter, number>({ n: 0 }, tape, incReducer);
  expect(out.n).toBe(111);
});

test("pureReplay: empty tape returns initial state unchanged", () => {
  const out = pureReplay<Counter, number>({ n: 42 }, [], incReducer);
  expect(out.n).toBe(42);
});

// ---------------------------------------------------------------------------
// structuralEquals
// ---------------------------------------------------------------------------

test("structuralEquals: primitives", () => {
  expect(structuralEquals(1, 1)).toBe(true);
  expect(structuralEquals(1, 2)).toBe(false);
  expect(structuralEquals("a", "a")).toBe(true);
  expect(structuralEquals(true, true)).toBe(true);
  expect(structuralEquals(null, null)).toBe(true);
  expect(structuralEquals(undefined, undefined)).toBe(true);
});

test("structuralEquals: NaN equals NaN (default mode)", () => {
  test.skip(MODE === "nan-blind", "intentionally broken under nan-blind");
  expect(structuralEquals(NaN, NaN)).toBe(true);
  expect(structuralEquals(NaN, 0)).toBe(false);
});

test("structuralEquals: arrays length + elements", () => {
  expect(structuralEquals([1, 2, 3], [1, 2, 3])).toBe(true);
  expect(structuralEquals([1, 2], [1, 2, 3])).toBe(false);
  expect(structuralEquals([1, 2, 3], [1, 3, 2])).toBe(false);
});

test("structuralEquals: nested objects, key-order insensitive", () => {
  const a = { x: 1, y: { a: [1, 2], b: "z" } };
  const b = { y: { b: "z", a: [1, 2] }, x: 1 };
  expect(structuralEquals(a, b)).toBe(true);
});

test("structuralEquals: extra key on one side → not equal", () => {
  expect(structuralEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  expect(structuralEquals({ a: 1, b: 2 }, { a: 1 })).toBe(false);
});

test("structuralEquals: array vs object with same numeric keys → not equal", () => {
  expect(structuralEquals([1, 2], { 0: 1, 1: 2, length: 2 })).toBe(false);
});

// ---------------------------------------------------------------------------
// withFloatTolerance
// ---------------------------------------------------------------------------

test("withFloatTolerance: accepts within epsilon, rejects above", () => {
  const eq = withFloatTolerance(1e-6);
  expect(eq(1.0, 1.0 + 1e-7)).toBe(true);
  expect(eq(1.0, 1.0 + 1e-3)).toBe(false);
  expect(eq({ x: 1.0 }, { x: 1.0 + 1e-7 })).toBe(true);
  expect(eq([1.0, 2.0], [1.0 + 1e-7, 2.0])).toBe(true);
  expect(eq([1.0, 2.0], [1.0 + 1e-3, 2.0])).toBe(false);
});

test("withFloatTolerance: epsilon must be non-negative", () => {
  expect(() => withFloatTolerance(-1)).toThrow();
});

test("withFloatTolerance: rejects Infinity vs Infinity", () => {
  // Infinity equality is not a "drift" question — if state goes to
  // Infinity, that's almost certainly a bug we want to surface.
  const eq = withFloatTolerance(1e-6);
  expect(eq(Infinity, Infinity)).toBe(false);
  expect(eq(-Infinity, -Infinity)).toBe(false);
});

// ---------------------------------------------------------------------------
// assertOrderingInvariant
// ---------------------------------------------------------------------------

const sampleTape: Tape<string> = [
  { tick: 1, clientId: "a", seq: 0, input: "L" },
  { tick: 1, clientId: "b", seq: 0, input: "R" },
  { tick: 2, clientId: "a", seq: 0, input: "U" },
];

test("assertOrderingInvariant: green when actual matches canonical", () => {
  const ok = assertOrderingInvariant(sampleTape, ["1:a:0", "1:b:0", "2:a:0"]);
  expect(ok).toEqual({ ok: true });
});

test("assertOrderingInvariant: red on swap, includes index + expected/actual", () => {
  const r = assertOrderingInvariant(sampleTape, ["1:b:0", "1:a:0", "2:a:0"]);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.reason).toContain("index 0");
    expect(r.reason).toContain("expected 1:a:0");
    expect(r.reason).toContain("DO applied 1:b:0");
  }
});

test("assertOrderingInvariant: red on length mismatch", () => {
  const r = assertOrderingInvariant(sampleTape, ["1:a:0", "1:b:0"]);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.reason).toContain("length mismatch");
  }
});

// ---------------------------------------------------------------------------
// HARNESS SELF-TEST — runs only when HARNESS_BREAK_MODE is set
// ---------------------------------------------------------------------------

test("self-test: unstable-order — orderTape FLIPS duplicate-key events", () => {
  test.skip(
    MODE !== "unstable-order",
    "only runs under HARNESS_BREAK_MODE=unstable-order",
  );
  const tape: Tape<string> = [
    { tick: 1, clientId: "a", seq: 0, input: "first" },
    { tick: 1, clientId: "a", seq: 0, input: "second" },
  ];
  const out = orderTape(tape).map((e) => e.input);
  // Under unstable-order, ties break by REVERSE input position.
  expect(out).toEqual(["second", "first"]);
});

test("self-test: drop-every-7th — pureReplay skips the 7th event", () => {
  test.skip(
    MODE !== "drop-every-7th",
    "only runs under HARNESS_BREAK_MODE=drop-every-7th",
  );
  const tape: Tape<number> = Array.from({ length: 7 }, (_, i): TapeEvent<number> => ({
    tick: i,
    clientId: "a",
    seq: 0,
    input: 1,
  }));
  // 7 events, but the 7th is dropped → only 6 increments.
  const out = pureReplay<Counter, number>({ n: 0 }, tape, incReducer);
  expect(out.n).toBe(6);
});

test("self-test: nan-blind — structuralEquals treats NaN as !== NaN", () => {
  test.skip(MODE !== "nan-blind", "only runs under HARNESS_BREAK_MODE=nan-blind");
  expect(structuralEquals(NaN, NaN)).toBe(false);
  // The convergence assertion is therefore unable to confirm two states
  // both holding NaN at the same key — exactly the bug class we want
  // to detect.
});

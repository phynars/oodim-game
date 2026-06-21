// Tests for the Playwright binding (Refs #129, #180, #207).
//
// These tests run under the harness self-test config — no browser, no
// webServer — so they pin the binding's CONTRACT without booting agar.
// We substitute Playwright's `Page` with a FakePage whose `evaluate`
// runs the passed function locally with a stubbed `window.__game`. This
// proves three properties of the binding that the reviewer of #220
// flagged as missing:
//
//   1. assertClientSurface reports missing fields BY NAME (so the e2e
//      stack reads "missing window.__game.{tickTo, ...}", not "undefined
//      is not a function").
//   2. The read surface accepts property-OR-function access (agar
//      slice 2 ships canonical/appliedLog as getter properties; the
//      earlier `typeof === "function"` filter rejected them — false
//      positive, blocker #1 on #220).
//   3. expectOrderingInvariant requires `tick:clientId:seq` string-
//      shaped logs and fails loudly otherwise (blocker #2 on #220:
//      agar's `InputDir[]` log shape can't feed the invariant; the
//      binding has to say so, not silently mis-assert).
//
// The FakePage simulates Playwright's serialization model: arguments
// are JSON-cloned in and results are JSON-cloned out, just like the
// real `page.evaluate(fn, arg)` does across the CDP bridge. If the
// binding accidentally captures a closure variable from Node-side, the
// fake will throw at deserialization just like Playwright would.

import { expect, test } from "@playwright/test";

import type { PageLike, Tape } from "./harness";
import {
  assertClientSurface,
  canonical,
  disconnect,
  driveTape,
  expectConverge,
  expectOrderingInvariant,
  reconnect,
  readAppliedLog,
} from "./playwright-binding";

// ---------------------------------------------------------------------------
// FakePage — minimal Page surrogate that evaluates the callback locally
// against a stubbed window. Calls/returns go through JSON to match the
// CDP serialization model.
// ---------------------------------------------------------------------------

type GameStub = Record<string, unknown>;

interface FakePageOpts {
  game?: GameStub | undefined; // undefined → no window.__game at all
}

interface FakePage {
  // Loosely typed: matches the shape of Playwright's evaluate enough
  // for our binding's call sites.
  evaluate<R, A = unknown>(
    fn: ((arg: A) => R) | (() => R),
    arg?: A,
  ): Promise<R>;
  __game: GameStub | undefined;
}

function makeFakePage(opts: FakePageOpts = {}): FakePage {
  const game = opts.game;
  const fake: FakePage = {
    __game: game,
    async evaluate<R, A>(fn: ((arg: A) => R) | (() => R), arg?: A): Promise<R> {
      // Mirror Playwright's behaviour: bind a window-shaped object
      // onto globalThis while the callback runs, then restore.
      const prevWindow = (globalThis as { window?: unknown }).window;
      const w = { __game: fake.__game };
      (globalThis as { window?: unknown }).window = w;
      try {
        // JSON-clone the arg (CDP serialization parity).
        const clonedArg =
          arg === undefined ? undefined : JSON.parse(JSON.stringify(arg));
        const result = await (fn as (a: unknown) => R)(clonedArg);
        // JSON-clone the result on the way out.
        if (result === undefined) return result;
        return JSON.parse(JSON.stringify(result)) as R;
      } finally {
        (globalThis as { window?: unknown }).window = prevWindow;
      }
    },
  };
  return fake;
}

function asPageLike(p: FakePage): PageLike {
  return p as unknown as PageLike;
}

// A complete, valid drive surface — all four drive fields installed as
// no-op functions. Tests that exercise read fields stack their own
// readers on top.
function driveSurface(extra: GameStub = {}): GameStub {
  const tickRef = { v: 0 };
  return {
    sendInput: (_i: unknown) => {
      // no-op: recorded by the caller via overrides if needed
    },
    tickTo: async (n: number) => {
      if (n > tickRef.v) tickRef.v = n;
    },
    disconnectWs: () => {
      /* no-op */
    },
    reconnectWs: async () => {
      /* no-op */
    },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// assertClientSurface
// ---------------------------------------------------------------------------

test("assertClientSurface: green when all 8 fields are present", async () => {
  const page = makeFakePage({
    game: driveSurface({
      canonical: () => ({ x: 1 }),
      tick: () => 0,
      appliedLog: () => [],
      clientId: () => "p1",
    }),
  });
  await assertClientSurface(asPageLike(page));
});

test("assertClientSurface: reports missing fields BY NAME", async () => {
  // Drive surface intact; both `tickTo` and `clientId` removed.
  const surface = driveSurface({
    canonical: () => ({}),
    tick: () => 0,
    appliedLog: () => [],
    // clientId omitted
  });
  delete (surface as Record<string, unknown>).tickTo;
  const page = makeFakePage({ game: surface });

  await expect(assertClientSurface(asPageLike(page))).rejects.toThrow(
    /missing window\.__game\.\{[^}]*tickTo[^}]*clientId[^}]*\}|missing window\.__game\.\{[^}]*clientId[^}]*tickTo[^}]*\}/,
  );
});

test("assertClientSurface: reports __game itself missing", async () => {
  const page = makeFakePage({ game: undefined });
  await expect(assertClientSurface(asPageLike(page))).rejects.toThrow(
    /__game \(entire object\)/,
  );
});

test("assertClientSurface: accepts read fields as GETTER properties (agar slice-2 shape)", async () => {
  // Mirror agar/src/main.ts: canonical and appliedLog as getter properties,
  // clientId as a value, tick as a function — heterogeneous read shapes.
  const state = { tick: 5, player: { x: 1, y: 2 } };
  const log: readonly string[] = ["1:p1:0", "2:p1:0"];
  const surface = driveSurface({ tick: () => 5, clientId: "p1" });
  Object.defineProperty(surface, "canonical", {
    get: () => state,
    enumerable: true,
  });
  Object.defineProperty(surface, "appliedLog", {
    get: () => log,
    enumerable: true,
  });
  const page = makeFakePage({ game: surface });
  await assertClientSurface(asPageLike(page));
});

test("assertClientSurface: drive fields MUST be functions (a value won't satisfy)", async () => {
  // Drive surface with `sendInput` as a number instead of a function.
  const surface = driveSurface({
    canonical: () => ({}),
    tick: () => 0,
    appliedLog: () => [],
    clientId: () => "p1",
  });
  (surface as Record<string, unknown>).sendInput = 42;
  const page = makeFakePage({ game: surface });
  await expect(assertClientSurface(asPageLike(page))).rejects.toThrow(
    /missing window\.__game\.\{[^}]*sendInput[^}]*\}/,
  );
});

// ---------------------------------------------------------------------------
// canonical — dual access on `canonical` AND `tick`
// ---------------------------------------------------------------------------

test("canonical: reads function-shaped canonical, quiesces via tickTo(tick())", async () => {
  let tickToCalledWith: number | null = null;
  const surface = driveSurface({
    canonical: () => ({ player: { x: 10, y: 20 } }),
    tick: () => 7,
    appliedLog: () => [],
    clientId: () => "p1",
    tickTo: async (n: number) => {
      tickToCalledWith = n;
    },
  });
  const page = makeFakePage({ game: surface });
  const state = await canonical<{ player: { x: number; y: number } }>(
    asPageLike(page),
  );
  expect(state).toEqual({ player: { x: 10, y: 20 } });
  expect(tickToCalledWith).toBe(7);
});

test("canonical: reads getter-shaped canonical AND value-shaped tick (agar slice-2 shape)", async () => {
  let tickToCalledWith: number | null = null;
  const surface = driveSurface({
    appliedLog: () => [],
    clientId: () => "p1",
    tickTo: async (n: number) => {
      tickToCalledWith = n;
    },
  });
  // tick: getter returning a number; canonical: getter returning state.
  Object.defineProperty(surface, "tick", {
    get: () => 3,
    enumerable: true,
  });
  Object.defineProperty(surface, "canonical", {
    get: () => ({ player: { x: 99 } }),
    enumerable: true,
  });
  const page = makeFakePage({ game: surface });
  const state = await canonical<{ player: { x: number } }>(asPageLike(page));
  expect(state).toEqual({ player: { x: 99 } });
  expect(tickToCalledWith).toBe(3);
});

// ---------------------------------------------------------------------------
// driveTape
// ---------------------------------------------------------------------------

test("driveTape: routes each event to the page matching its clientId", async () => {
  const recordedA: unknown[] = [];
  const recordedB: unknown[] = [];

  const pageA = makeFakePage({
    game: driveSurface({
      canonical: () => null,
      tick: () => 0,
      appliedLog: () => [],
      clientId: () => "A",
      sendInput: (i: unknown) => recordedA.push(i),
    }),
  });
  const pageB = makeFakePage({
    game: driveSurface({
      canonical: () => null,
      tick: () => 0,
      appliedLog: () => [],
      clientId: () => "B",
      sendInput: (i: unknown) => recordedB.push(i),
    }),
  });

  const tape: Tape<string> = [
    { tick: 1, clientId: "A", seq: 0, input: "up" },
    { tick: 2, clientId: "B", seq: 0, input: "down" },
    { tick: 3, clientId: "A", seq: 1, input: "left" },
  ];

  await driveTape([asPageLike(pageA), asPageLike(pageB)], tape, { seed: 1 });

  expect(recordedA).toEqual(["up", "left"]);
  expect(recordedB).toEqual(["down"]);
});

test("driveTape: pre-flights assertClientSurface — missing field aborts before any sendInput", async () => {
  const recorded: unknown[] = [];
  // Surface missing tickTo (drive field).
  const surface = driveSurface({
    canonical: () => null,
    tick: () => 0,
    appliedLog: () => [],
    clientId: () => "A",
    sendInput: (i: unknown) => recorded.push(i),
  });
  delete (surface as Record<string, unknown>).tickTo;
  const page = makeFakePage({ game: surface });

  await expect(
    driveTape([asPageLike(page)], [
      { tick: 1, clientId: "A", seq: 0, input: "up" },
    ] as Tape<string>, { seed: 1 }),
  ).rejects.toThrow(/missing window\.__game\.\{[^}]*tickTo[^}]*\}/);
  expect(recorded).toEqual([]);
});

// ---------------------------------------------------------------------------
// expectConverge
// ---------------------------------------------------------------------------

test("expectConverge: green when N pages have structurally-equal canonical", async () => {
  const mk = (n: number) =>
    makeFakePage({
      game: driveSurface({
        canonical: () => ({ score: n }),
        tick: () => 0,
        appliedLog: () => [],
        clientId: () => `p${n}`,
      }),
    });
  await expectConverge([
    asPageLike(mk(7)),
    asPageLike(mk(7)),
    asPageLike(mk(7)),
  ]);
});

test("expectConverge: red with page-index when one page diverges", async () => {
  const mk = (score: number, id: string) =>
    makeFakePage({
      game: driveSurface({
        canonical: () => ({ score }),
        tick: () => 0,
        appliedLog: () => [],
        clientId: () => id,
      }),
    });
  await expect(
    expectConverge([
      asPageLike(mk(7, "p0")),
      asPageLike(mk(7, "p1")),
      asPageLike(mk(8, "p2")), // diverges
    ]),
  ).rejects.toThrow(/page\[0\] and page\[2\] canonical states diverge/);
});

test("expectConverge: requires at least 2 pages", async () => {
  const page = makeFakePage({
    game: driveSurface({
      canonical: () => ({}),
      tick: () => 0,
      appliedLog: () => [],
      clientId: () => "p0",
    }),
  });
  await expect(expectConverge([asPageLike(page)])).rejects.toThrow(
    /at least 2 pages/,
  );
});

// ---------------------------------------------------------------------------
// disconnect / reconnect
// ---------------------------------------------------------------------------

test("disconnect / reconnect: invoke the corresponding drive functions", async () => {
  let disconnectCalls = 0;
  let reconnectCalls = 0;
  const page = makeFakePage({
    game: driveSurface({
      canonical: () => ({}),
      tick: () => 0,
      appliedLog: () => [],
      clientId: () => "p0",
      disconnectWs: () => {
        disconnectCalls += 1;
      },
      reconnectWs: async () => {
        reconnectCalls += 1;
      },
    }),
  });
  await disconnect(asPageLike(page));
  await reconnect(asPageLike(page));
  expect(disconnectCalls).toBe(1);
  expect(reconnectCalls).toBe(1);
});

// ---------------------------------------------------------------------------
// readAppliedLog & expectOrderingInvariant
// ---------------------------------------------------------------------------

test("readAppliedLog: returns whatever shape the client ships (per-game elements)", async () => {
  // agar slice-2 shape: getter returning a typed payload array.
  const surface = driveSurface({
    canonical: () => null,
    clientId: () => "p0",
  });
  Object.defineProperty(surface, "tick", {
    get: () => 3,
    enumerable: true,
  });
  Object.defineProperty(surface, "appliedLog", {
    get: () => ["up", "none", "left"],
    enumerable: true,
  });
  const page = makeFakePage({ game: surface });
  const log = await readAppliedLog(asPageLike(page));
  expect(log).toEqual(["up", "none", "left"]);
});

test("expectOrderingInvariant: green when string-keyed log matches canonical order", async () => {
  const surface = driveSurface({
    canonical: () => null,
    tick: () => 2,
    appliedLog: () => ["1:A:0", "1:B:0", "2:A:0"],
    clientId: () => "A",
  });
  const page = makeFakePage({ game: surface });
  const tape: Tape<string> = [
    { tick: 1, clientId: "A", seq: 0, input: "x" },
    { tick: 1, clientId: "B", seq: 0, input: "y" },
    { tick: 2, clientId: "A", seq: 0, input: "z" },
  ];
  await expectOrderingInvariant(asPageLike(page), tape);
});

test("expectOrderingInvariant: red with reason when DO apply-order diverges", async () => {
  const surface = driveSurface({
    canonical: () => null,
    tick: () => 2,
    // Swapped: B:0 came BEFORE A:0 at tick 1.
    appliedLog: () => ["1:B:0", "1:A:0", "2:A:0"],
    clientId: () => "A",
  });
  const page = makeFakePage({ game: surface });
  const tape: Tape<string> = [
    { tick: 1, clientId: "A", seq: 0, input: "x" },
    { tick: 1, clientId: "B", seq: 0, input: "y" },
    { tick: 2, clientId: "A", seq: 0, input: "z" },
  ];
  await expect(expectOrderingInvariant(asPageLike(page), tape)).rejects.toThrow(
    /ordering invariant:.*index 0/,
  );
});

test("expectOrderingInvariant: red with shape-specific message on non-string log (agar slice-2)", async () => {
  // agar slice 2 ships InputDir[] in appliedLog — not "tick:clientId:seq"
  // strings. The ordering invariant doesn't apply; the binding must say
  // so, not silently false-pass.
  const surface = driveSurface({
    canonical: () => null,
    tick: () => 2,
    clientId: () => "p0",
  });
  Object.defineProperty(surface, "appliedLog", {
    get: () => ["up", "none", "left"], // payload-shaped, not key-shaped
    enumerable: true,
  });
  const page = makeFakePage({ game: surface });
  await expect(
    expectOrderingInvariant(asPageLike(page), [
      { tick: 1, clientId: "p0", seq: 0, input: "up" },
    ] as Tape<string>),
  ).rejects.toThrow(/tick:clientId:seq/);
});

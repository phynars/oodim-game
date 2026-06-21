// Playwright bindings for the multiplayer harness — closes #129's last
// slice by giving #180 a target shape so the two-client e2e doesn't have
// to invent its own glue.
//
// CONTRACT: this module consumes the 8 fields documented in
// `./CLIENT-TEST-SURFACE.md` on `window.__game`:
//   read:  canonical, tick, appliedLog, clientId       (property OR () => T)
//   drive: sendInput, tickTo, disconnectWs, reconnectWs (functions only)
//
// PROPERTY-OR-FUNCTION (read-surface dual access)
//
// Slice 2 (#179) shipped `canonical` and `appliedLog` as ES5 getter
// PROPERTIES on `window.__game`, not as zero-arg functions. The earlier
// draft of this binding required `typeof === "function"` for all eight
// fields, which immediately threw on agar with "missing canonical,
// appliedLog" — false positives.
//
// Resolution: the harness binds against the OBSERVABLE shape. For the
// four READ fields, the page may expose either a getter property or a
// zero-arg function — the binding calls `v()` if it's callable, else
// reads it as a value. Drive-surface fields stay function-only (they
// take an argument or perform an action).
//
// This is not a contract softening: the field names are still normative
// (renaming `canonical` to `state` still fails by name), and the read
// types are unchanged. We just stop punishing clients for choosing
// ergonomic getters over zero-arg call sites.
//
// APPLIEDLOG ELEMENT SHAPE
//
// `appliedLog` is the per-game "list of things applied in order". Its
// element shape is game-specific:
//   - agar slice 2 (single client, server pushes one `dir` per tick):
//     `readonly InputDir[]` — e.g. ["up", "none", "left", ...].
//   - multi-client products (the case `assertOrderingInvariant`
//     targets): `readonly string[]` of `tick:clientId:seq` keys.
//
// `readAppliedLog` returns `readonly unknown[]` and leaves the element
// type to the caller. `expectOrderingInvariant` REQUIRES the elements
// to be `tick:clientId:seq` strings and throws a precise error if it
// gets a non-string-shaped log — that's the contract for the ordering
// invariant specifically, not for `appliedLog` in general.
//
// QUIESCE MODEL
//
// All read primitives quiesce on a TICK boundary, never on wallclock.
// `canonical(page)` calls `__game.tickTo(__game.tick())` first — which
// is a no-op tick advance that the client's harness hook resolves only
// after every queued event up to the current tick has applied and the
// ws is idle. This eliminates wallclock flake (`waitForTimeout` is
// banned by #129's acceptance criteria) without exposing a separate
// `quiesce()` field. When a client exposes `tick` as a getter, we read
// the value instead of calling it.

import type { Page } from "@playwright/test";
import type {
  Disconnect,
  DriveTape,
  ExpectConverge,
  MultiplayerHarness,
  PageLike,
  ReadCanonical,
  Reconnect,
  Tape,
  TapeEvent,
} from "./harness";
import {
  assertOrderingInvariant,
  structuralEquals,
} from "./harness";

// ---------------------------------------------------------------------------
// PageLike bridge
// ---------------------------------------------------------------------------

function asPage(p: PageLike): Page {
  return p as unknown as Page;
}

// ---------------------------------------------------------------------------
// Field-presence guard
//
// The read fields (canonical, tick, appliedLog, clientId) may be EITHER
// a callable function OR a defined non-undefined property (getter).
// The drive fields must be callable functions — they take arguments
// or perform side effects.
//
// On failure we report the missing fields BY NAME so e2e debugging
// reads "missing window.__game.{tickTo, disconnectWs}" instead of
// "undefined is not a function" buried in a CDP stack.
// ---------------------------------------------------------------------------

const READ_FIELDS = ["canonical", "tick", "appliedLog", "clientId"] as const;
const DRIVE_FIELDS = [
  "sendInput",
  "tickTo",
  "disconnectWs",
  "reconnectWs",
] as const;

export async function assertClientSurface(page: PageLike): Promise<void> {
  const missing = await asPage(page).evaluate(
    ({ readFields, driveFields }) => {
      const w = window as unknown as { __game?: Record<string, unknown> };
      if (!w.__game) return ["__game (entire object)"];
      const g = w.__game;
      const miss: string[] = [];
      // Read fields: present (function or any defined value).
      for (const f of readFields) {
        const v = g[f];
        if (typeof v === "function") continue;
        if (v !== undefined && v !== null) continue;
        miss.push(f);
      }
      // Drive fields: must be functions.
      for (const f of driveFields) {
        if (typeof g[f] !== "function") miss.push(f);
      }
      return miss;
    },
    {
      readFields: READ_FIELDS as unknown as string[],
      driveFields: DRIVE_FIELDS as unknown as string[],
    },
  );

  if (missing.length > 0) {
    throw new Error(
      `client test surface incomplete: missing window.__game.{${missing.join(
        ", ",
      )}}. See e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md — these field names are normative.`,
    );
  }
}

// ---------------------------------------------------------------------------
// In-page read helper: call-or-read on a window.__game field.
//
// Inlined via `page.evaluate` rather than a Node-side helper because the
// field access has to happen in the page context. Each reader below
// installs its own short evaluate fn that uses this same dual-access
// pattern — the duplication is deliberate; a shared utility would force
// every read to ship the same boilerplate through CDP.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// driveTape
// ---------------------------------------------------------------------------

export const driveTape: DriveTape = async (pages, tape, _opts) => {
  // Pre-flight: surface must be present on all pages before we drive.
  for (const p of pages) await assertClientSurface(p);

  // Group events by clientId so each page only sees its own inputs.
  const byClient = new Map<string, TapeEvent<unknown>[]>();
  for (const ev of tape as Tape<unknown>) {
    const bucket = byClient.get(ev.clientId);
    if (bucket) bucket.push(ev);
    else byClient.set(ev.clientId, [ev]);
  }

  // Resolve each page's clientId (dual access), then ship that page's
  // slice. Run pages in parallel — each one's tickTo waits on its own
  // DO state.
  await Promise.all(
    pages.map(async (pageLike) => {
      const page = asPage(pageLike);
      const myId = await page.evaluate(() => {
        const w = window as unknown as {
          __game: { clientId: unknown };
        };
        const v = w.__game.clientId;
        return typeof v === "function" ? (v as () => string)() : (v as string);
      });
      const myEvents = byClient.get(myId) ?? [];
      // Apply events strictly in tape order. For each event: advance
      // simulated time to its tick, then send the input. tickTo is a
      // no-op when the page is already at or past the requested tick.
      for (const ev of myEvents) {
        await page.evaluate(
          ([t, input]) => {
            const w = window as unknown as {
              __game: {
                tickTo: (n: number) => Promise<void>;
                sendInput: (i: unknown) => void;
              };
            };
            return w.__game.tickTo(t as number).then(() => {
              w.__game.sendInput(input);
            });
          },
          [ev.tick, ev.input] as [number, unknown],
        );
      }
    }),
  );
};

// ---------------------------------------------------------------------------
// canonical
//
// Read window.__game.canonical AFTER ws-quiescing on a tick boundary.
// Quiesce idiom: ask the page to tickTo its own current tick — the
// contract resolves only when every queued event up to that tick has
// applied and the ws is idle. Both `tick` and `canonical` support the
// property-or-function dual access.
// ---------------------------------------------------------------------------

export const canonical: ReadCanonical = async <TState>(pageLike: PageLike) => {
  const page = asPage(pageLike);
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        tick: unknown;
        tickTo: (n: number) => Promise<void>;
        canonical: unknown;
      };
    };
    const tickField = w.__game.tick;
    const curTick =
      typeof tickField === "function"
        ? (tickField as () => number)()
        : (tickField as number);
    return w.__game.tickTo(curTick).then(() => {
      const c = w.__game.canonical;
      return typeof c === "function" ? (c as () => unknown)() : c;
    });
  }) as Promise<TState>;
};

// ---------------------------------------------------------------------------
// expectConverge
// ---------------------------------------------------------------------------

export const expectConverge: ExpectConverge = async (pages, predicate) => {
  if (pages.length < 2) {
    throw new Error(
      `expectConverge needs at least 2 pages, got ${pages.length}`,
    );
  }
  const eq = predicate ?? structuralEquals;
  const states = await Promise.all(pages.map((p) => canonical(p)));
  const head = states[0];
  for (let i = 1; i < states.length; i++) {
    if (!eq(head, states[i])) {
      throw new Error(
        `expectConverge: page[0] and page[${i}] canonical states diverge. ` +
          `page[0]=${JSON.stringify(head)} page[${i}]=${JSON.stringify(states[i])}`,
      );
    }
  }
};

// ---------------------------------------------------------------------------
// disconnect / reconnect
// ---------------------------------------------------------------------------

export const disconnect: Disconnect = async (pageLike) => {
  const page = asPage(pageLike);
  await page.evaluate(() => {
    const w = window as unknown as {
      __game: { disconnectWs: () => void };
    };
    w.__game.disconnectWs();
  });
};

export const reconnect: Reconnect = async (pageLike) => {
  const page = asPage(pageLike);
  await page.evaluate(() => {
    const w = window as unknown as {
      __game: { reconnectWs: () => Promise<void> };
    };
    return w.__game.reconnectWs();
  });
};

// ---------------------------------------------------------------------------
// readAppliedLog — for the ordering invariant.
//
// Returns `readonly unknown[]` because the element shape is per-game:
// agar slice 2 ships `InputDir[]`; multi-client products ship
// `tick:clientId:seq` strings. Quiesces on a tick boundary, dual access
// on `tick` and `appliedLog`.
// ---------------------------------------------------------------------------

export async function readAppliedLog(
  pageLike: PageLike,
): Promise<readonly unknown[]> {
  const page = asPage(pageLike);
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        tick: unknown;
        tickTo: (n: number) => Promise<void>;
        appliedLog: unknown;
      };
    };
    const tickField = w.__game.tick;
    const curTick =
      typeof tickField === "function"
        ? (tickField as () => number)()
        : (tickField as number);
    return w.__game.tickTo(curTick).then(() => {
      const a = w.__game.appliedLog;
      return typeof a === "function"
        ? (a as () => readonly unknown[])()
        : (a as readonly unknown[]);
    });
  });
}

// ---------------------------------------------------------------------------
// expectOrderingInvariant
//
// Composes readAppliedLog + assertOrderingInvariant. Requires the
// applied-log elements to be `tick:clientId:seq` strings — the shape
// `assertOrderingInvariant` is contracted against. Throws a clear,
// shape-specific error when the log isn't string-shaped (e.g. a
// single-client client like agar slice 2 that logs `InputDir` values
// instead of canonical keys).
// ---------------------------------------------------------------------------

export async function expectOrderingInvariant<T>(
  pageLike: PageLike,
  tape: Tape<T>,
): Promise<void> {
  const log = await readAppliedLog(pageLike);

  // The ordering invariant compares the DO's apply-order against the
  // canonical order of the tape, keyed by `tick:clientId:seq`. The log
  // MUST be a sequence of strings. If a client ships a per-tick payload
  // log (agar slice 2 ships `InputDir[]`) the ordering invariant is not
  // applicable to that game — fail loudly so the spec author switches
  // to convergence assertion instead of getting a silent false-green.
  if (
    !Array.isArray(log) ||
    !log.every((x) => typeof x === "string")
  ) {
    throw new Error(
      "expectOrderingInvariant: appliedLog elements must be " +
        '"tick:clientId:seq" strings. ' +
        "This game's appliedLog ships a different element shape — use " +
        "expectConverge for convergence, or extend the client to expose " +
        "canonical-key strings.",
    );
  }

  const result = assertOrderingInvariant(tape, log as readonly string[]);
  if (!result.ok) {
    throw new Error(`ordering invariant: ${result.reason}`);
  }
}

// ---------------------------------------------------------------------------
// Bundled harness surface
// ---------------------------------------------------------------------------

export const harness: MultiplayerHarness = {
  driveTape,
  canonical,
  expectConverge,
  disconnect,
  reconnect,
};

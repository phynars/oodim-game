// Playwright bindings for the multiplayer harness — closes #129's last
// slice by giving #180 a target shape so the two-client e2e doesn't have
// to invent its own glue.
//
// CONTRACT: this module consumes the 8 fields documented in
// `./CLIENT-TEST-SURFACE.md` on `window.__game`:
//   read:  canonical, tick, appliedLog, clientId
//   drive: sendInput, tickTo, disconnectWs, reconnectWs
//
// Any deviation in field names is REQUEST_CHANGES by the doc — this file
// is the enforcement: a client that ships `state` instead of `canonical`
// (or `applyOrder` instead of `appliedLog`) FAILS to bind, and the e2e
// suite reports the missing field by name rather than a generic
// "page.evaluate threw".
//
// WHY THIS FILE EXISTS BEFORE #180 LANDS
//
// #129's harness.ts ships TYPES only for the page-bound primitives
// (DriveTape, ReadCanonical, ExpectConverge, Disconnect, Reconnect). The
// types compile against the contract; the bindings exist to PROVE the
// contract is bindable in a single deterministic shape — so the first
// multiplayer consumer (agar-03 / #180) imports it instead of writing
// page.evaluate spaghetti per spec.
//
// WHY page.evaluate, NOT exposed window functions
//
// Playwright's `page.evaluate(fn, arg)` serializes `arg` to JSON, ships
// it across the CDP bridge, executes `fn` in the page context, and
// returns its JSON-serialized result. That is the same wire shape the
// harness already contracts state to (`structuralEquals` requires
// JSON-ish state). One serialization model end-to-end → no schema drift.
//
// QUIESCE MODEL
//
// All read primitives quiesce on a TICK boundary, never on wallclock.
// `canonical(page)` calls `__game.tickTo(__game.tick())` first — which
// is a no-op tick advance that the client's harness hook resolves only
// after every queued event up to the current tick has applied and the
// ws is idle. This eliminates wallclock flake (`waitForTimeout` is
// banned by #129's acceptance criteria) without exposing a separate
// `quiesce()` field.

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
//
// harness.ts declares PageLike as opaque so it has zero @playwright/test
// dependency. Here we cross the boundary: bindings take real `Page` and
// the harness types take `PageLike`. The cast is local to this module;
// no other file imports Playwright.
// ---------------------------------------------------------------------------

function asPage(p: PageLike): Page {
  return p as unknown as Page;
}

// ---------------------------------------------------------------------------
// Field-presence guard
//
// Run once per page before the first read/drive call. Surfaces missing
// fields by NAME — the doc's enforcement rule depends on this being a
// readable failure, not "undefined is not a function" buried in a stack.
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  "canonical",
  "tick",
  "appliedLog",
  "clientId",
  "sendInput",
  "tickTo",
  "disconnectWs",
  "reconnectWs",
] as const;

export async function assertClientSurface(page: PageLike): Promise<void> {
  const missing = await asPage(page).evaluate((fields) => {
    const w = window as unknown as { __game?: Record<string, unknown> };
    if (!w.__game) return ["__game (entire object)"];
    return fields.filter((f) => typeof w.__game?.[f] !== "function");
  }, REQUIRED_FIELDS as unknown as string[]);

  if (missing.length > 0) {
    throw new Error(
      `client test surface incomplete: missing window.__game.{${missing.join(
        ", ",
      )}}. See e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md — these field names are normative.`,
    );
  }
}

// ---------------------------------------------------------------------------
// driveTape
//
// Apply a tape to N pages. The tape is split by clientId; each client
// gets ONLY the events attributed to it, in canonical order. The DO
// already handles cross-client ordering — driveTape does NOT inject one
// client's events into another's page.
//
// `seed` is forwarded via __game.tickTo(0) convention: clients read seed
// from URL/query at boot, so `seed` here is recorded for assertion
// purposes (e.g. pureReplay) rather than re-injected per call. The
// contract: pages MUST already be navigated with `?seed=N` matching
// `opts.seed`. If you forget this, the ordering invariant will fail
// loudly — that is the intended failure mode.
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

  // Resolve each page's clientId, then ship that page's slice.
  // Run pages in parallel — each one's tickTo waits on its own DO state.
  await Promise.all(
    pages.map(async (pageLike) => {
      const page = asPage(pageLike);
      const myId = await page.evaluate(() => {
        const w = window as unknown as {
          __game: { clientId: () => string };
        };
        return w.__game.clientId();
      });
      const myEvents = byClient.get(myId) ?? [];
      // Apply events strictly in ascending tick. For each event: advance
      // simulated time to its tick, then send the input. tickTo is a
      // no-op when the page is already at or past the requested tick,
      // so safe to call repeatedly.
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
// Read window.__game.canonical() AFTER ws-quiescing on a tick boundary.
// The quiesce-by-tickTo idiom: ask the page to advance to its own
// current tick — by contract that promise resolves only when every
// queued event up to that tick has applied and the ws is idle.
// ---------------------------------------------------------------------------

export const canonical: ReadCanonical = async <TState>(pageLike: PageLike) => {
  const page = asPage(pageLike);
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        tick: () => number;
        tickTo: (n: number) => Promise<void>;
        canonical: () => unknown;
      };
    };
    return w.__game.tickTo(w.__game.tick()).then(() => w.__game.canonical());
  }) as Promise<TState>;
};

// ---------------------------------------------------------------------------
// expectConverge
//
// Read canonical from every page (in parallel, AFTER each page quiesces)
// then assert structural equality pair-wise against pages[0]. Reports the
// FIRST divergence with its page index so a 4-client suite tells you
// "page 2 diverged" rather than "convergence failed".
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
// readAppliedLog — for the ordering invariant
//
// Pulled out as a named export rather than folded into `canonical`
// because the ordering invariant asserts against this independent of
// state — a DO that re-orders inputs but happens to produce the same
// state by coincidence is still wrong.
// ---------------------------------------------------------------------------

export async function readAppliedLog(
  pageLike: PageLike,
): Promise<readonly string[]> {
  const page = asPage(pageLike);
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        tick: () => number;
        tickTo: (n: number) => Promise<void>;
        appliedLog: () => readonly string[];
      };
    };
    return w.__game.tickTo(w.__game.tick()).then(() => w.__game.appliedLog());
  });
}

// ---------------------------------------------------------------------------
// expectOrderingInvariant
//
// Composes readAppliedLog + assertOrderingInvariant. Asserts the DO
// applied events in canonical order (tick, clientId, seq). Throws on
// violation with the reason string from the harness's pure assertion.
// ---------------------------------------------------------------------------

export async function expectOrderingInvariant<T>(
  pageLike: PageLike,
  tape: Tape<T>,
): Promise<void> {
  const log = await readAppliedLog(pageLike);
  const result = assertOrderingInvariant(tape, log);
  if (!result.ok) {
    throw new Error(`ordering invariant: ${result.reason}`);
  }
}

// ---------------------------------------------------------------------------
// Bundled harness surface
//
// One import for spec files: `import { harness } from "e2e-shared/multiplayer/playwright-binding"`.
// Matches the MultiplayerHarness interface from ./harness so consumers
// can typecheck against the contract.
// ---------------------------------------------------------------------------

export const harness: MultiplayerHarness = {
  driveTape,
  canonical,
  expectConverge,
  disconnect,
  reconnect,
};

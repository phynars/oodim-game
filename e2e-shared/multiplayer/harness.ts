// Multiplayer e2e harness primitives — the contract from #129.
//
// SHARED LOCATION: this file is the canonical home for the multiplayer
// harness primitives. Any game's e2e (doom/, agar/, future products) that
// needs deterministic replay + canonical-state convergence imports from
// `e2e-shared/multiplayer/harness`. Do NOT clone into per-game e2e/lib/
// — the whole point of #129's "second multiplayer game must reuse them
// as-is" clause is that there is one harness, not N.
//
// History: originally lived under `doom/e2e/lib/multiplayer-harness.ts`
// because `agar/` wasn't writable when #129 landed. Relocated under #162
// in the window between agar-00 (scaffold) and agar-02 (authoritative
// tick — first real consumer). The HARNESS_BREAK_MODE self-fixture
// matrix proves byte-for-byte semantic preservation across the move.
//
// SHAPE OF THE CONTRACT
//
// The four assertions (see #129) the harness exists to make cheap:
//   1. Seeded input tape — both clients
//   2. Canonical-state convergence (structural equality, NOT screenshot)
//   3. Ordering invariant (DO output == pure offline reducer over same log)
//   4. Reconnect-replay equivalence
//
// This file ships:
//   - TYPE signatures for the Playwright-bound primitives (driveTape,
//     canonical, expectConverge, disconnect, reconnect). The bindings are
//     filed separately as the next slice — they cannot land until agar/
//     has a real DO + ws to talk to.
//   - PURE implementations of the bits that don't need a browser:
//     orderTape, pureReplay, structuralEquals, withFloatTolerance,
//     assertOrderingInvariant. These are unit-testable today and ARE
//     unit-tested in `harness.spec.ts` in the same dir.
//   - HarnessBreakMode — the in-tree self-fixture switch. Sets a
//     deliberately-broken behaviour the harness should detect. The
//     harness-self-test job in CI runs the assertions under each mode and
//     verifies they go RED; this is how #129's "fails-on-unfixed" criterion
//     is satisfied without a separate broken-branch fixture.
//
// What this file is NOT:
//   - A game. There is no agar-server, no DO, no websocket. Just shapes.
//   - A Playwright dependency. The pure pieces below have zero imports so
//     they can be unit-tested under any runner and reused server-side as
//     the reducer-of-record.

// ---------------------------------------------------------------------------
// Self-fixture: HARNESS_BREAK_MODE
//
// Read at module load. Implementations under test consult this to
// deliberately violate ONE invariant; the harness-self-test CI job runs the
// spec under each non-"off" mode and asserts the corresponding assertion
// fails. Production code MUST never set this. Default is "off".
// ---------------------------------------------------------------------------
export type HarnessBreakMode =
  | "off"
  // orderTape sorts unstably — two events at the same (tick, clientId,
  // sequence) swap. The ordering-invariant assertion must catch this.
  | "unstable-order"
  // pureReplay drops every 7th event. expectConverge against a non-broken
  // peer must catch this.
  | "drop-every-7th"
  // structuralEquals treats NaN as equal to itself by reference, missing
  // intentional NaN-in-state divergences. The self-test asserts the
  // equality predicate REJECTS NaN-vs-number cases.
  | "nan-blind";

export function harnessBreakMode(): HarnessBreakMode {
  // In Node/Playwright contexts: process.env. In browser-evaluated
  // contexts (page.evaluate): falls through to "off".
  const env =
    typeof process !== "undefined" && process.env
      ? process.env.HARNESS_BREAK_MODE
      : undefined;
  if (
    env === "unstable-order" ||
    env === "drop-every-7th" ||
    env === "nan-blind"
  ) {
    return env;
  }
  return "off";
}

// ---------------------------------------------------------------------------
// Tape shape
// ---------------------------------------------------------------------------

/**
 * One scripted input. `tick` is the simulated tick at which the input is
 * applied (NOT wallclock ms — the harness drives ticks deterministically).
 * `clientId` identifies the sender. `seq` is a per-client monotonic
 * sequence number; combined with (tick, clientId) it makes the canonical
 * ordering total.
 */
export interface TapeEvent<TInput = unknown> {
  readonly tick: number;
  readonly clientId: string;
  readonly seq: number;
  readonly input: TInput;
}

export type Tape<TInput = unknown> = readonly TapeEvent<TInput>[];

/**
 * Canonical order for events: ascending (tick, clientId, seq). This is the
 * order the DO is contracted to apply them in; pureReplay applies them in
 * this order; the ordering-invariant assertion compares the DO's actual
 * apply-order against this.
 *
 * STABILITY MATTERS: two events at the same (tick, clientId, seq) are
 * malformed by contract, but we still sort defensively to a stable order
 * (input position) so duplicate-key tapes don't flip between runs.
 */
export function orderTape<T>(tape: Tape<T>): TapeEvent<T>[] {
  const mode = harnessBreakMode();
  const indexed = tape.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => {
    if (a.e.tick !== b.e.tick) return a.e.tick - b.e.tick;
    if (a.e.clientId !== b.e.clientId)
      return a.e.clientId < b.e.clientId ? -1 : 1;
    if (a.e.seq !== b.e.seq) return a.e.seq - b.e.seq;
    // Stable tiebreak by original position — UNLESS we're deliberately
    // exercising the unstable-order break mode in self-tests.
    if (mode === "unstable-order") return b.i - a.i;
    return a.i - b.i;
  });
  return indexed.map((x) => x.e);
}

// ---------------------------------------------------------------------------
// Pure reducer
//
// The signature the agar-server's DO reducer must conform to. Shipping
// it here (zero deps) means the same function can run in the DO AND in
// the test harness — one reducer, two callers, no drift.
// ---------------------------------------------------------------------------

export type Reducer<TState, TInput> = (
  prev: TState,
  event: TapeEvent<TInput>,
) => TState;

/**
 * Apply `tape` to `initial` in canonical order, returning the final state.
 * Deterministic given (initial, tape, reducer). Seed handling is the
 * reducer's responsibility — it should derive any randomness from
 * (state.seed, event.tick, event.seq), never Math.random().
 *
 * In `drop-every-7th` break mode, every 7th event (1-indexed) is skipped.
 * The convergence assertion against a non-broken peer must catch this.
 */
export function pureReplay<TState, TInput>(
  initial: TState,
  tape: Tape<TInput>,
  reducer: Reducer<TState, TInput>,
): TState {
  const ordered = orderTape(tape);
  const mode = harnessBreakMode();
  let state = initial;
  for (let i = 0; i < ordered.length; i++) {
    if (mode === "drop-every-7th" && (i + 1) % 7 === 0) continue;
    state = reducer(state, ordered[i]!);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Structural equality
//
// Convergence assertion compares state via structuralEquals, NOT a
// screenshot. Pixels are downstream; convergence is upstream.
// ---------------------------------------------------------------------------

/**
 * Deep structural equality. Handles:
 *   - primitives (incl. NaN: NaN === NaN is TRUE under this predicate,
 *     because two states both holding NaN at the same key ARE equal as
 *     state — divergence is when one is NaN and one isn't)
 *   - arrays (length + element-wise)
 *   - plain objects (key sets equal, value-wise; key insertion order is
 *     irrelevant)
 * Does NOT handle: Maps, Sets, Dates, RegExps, class instances, cycles.
 * State emitted by the DO is contracted to be plain JSON-ish — if that
 * stops being true, this predicate widens.
 *
 * In `nan-blind` break mode, NaN comparisons fall through to ===, which
 * returns false for NaN === NaN — the inverse of the contract. The
 * harness-self-test asserts that under this mode, a NaN-bearing state
 * does NOT structurally equal itself.
 */
export function structuralEquals(a: unknown, b: unknown): boolean {
  const mode = harnessBreakMode();
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) {
      return mode !== "nan-blind";
    }
    return false;
  }
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!structuralEquals(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const akeys = Object.keys(ao);
  const bkeys = Object.keys(bo);
  if (akeys.length !== bkeys.length) return false;
  for (const k of akeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!structuralEquals(ao[k], bo[k])) return false;
  }
  return true;
}

/**
 * Build an equality predicate that tolerates float drift up to `epsilon`
 * absolute. For physics-y state where the DO's float math may not be
 * bit-identical to a JS-side reducer's. Use sparingly — the goal is
 * canonical convergence, not "close enough".
 *
 * Returns a predicate with the same shape as `structuralEquals`.
 */
export function withFloatTolerance(
  epsilon: number,
): (a: unknown, b: unknown) => boolean {
  if (!(epsilon >= 0)) {
    throw new Error("withFloatTolerance: epsilon must be >= 0");
  }
  const eq = (a: unknown, b: unknown): boolean => {
    // NOTE: the number-vs-number branch runs BEFORE the generic `a === b`
    // short-circuit on purpose. `Infinity === Infinity` is true in JS, but
    // we want Infinity to fail equality here — if state goes to Infinity
    // that's almost certainly a bug we want to surface (see the spec's
    // "rejects Infinity vs Infinity" case). The finite-guard below catches
    // both Infinity and -Infinity for either operand.
    if (typeof a === "number" && typeof b === "number") {
      if (Number.isNaN(a) && Number.isNaN(b)) return true;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return Math.abs(a - b) <= epsilon;
    }
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!eq(a[i], b[i])) return false;
      }
      return true;
    }
    if (Array.isArray(b)) return false;
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const akeys = Object.keys(ao);
    const bkeys = Object.keys(bo);
    if (akeys.length !== bkeys.length) return false;
    for (const k of akeys) {
      if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
      if (!eq(ao[k], bo[k])) return false;
    }
    return true;
  };
  return eq;
}

// ---------------------------------------------------------------------------
// Ordering invariant
// ---------------------------------------------------------------------------

/**
 * Assert the DO's actual apply-order matches the canonical order of the
 * tape. `actualOrder` is the sequence of event keys (`tick:clientId:seq`)
 * the DO reports it processed.
 *
 * Returns { ok: true } on match, or { ok: false, reason } on violation —
 * the harness wraps this in Playwright's `expect(...).toEqual({ ok: true })`
 * so the failure message is the reason string, not a stack trace.
 */
export type OrderingResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function assertOrderingInvariant<T>(
  tape: Tape<T>,
  actualOrder: readonly string[],
): OrderingResult {
  const expected = orderTape(tape).map(
    (e) => `${e.tick}:${e.clientId}:${e.seq}`,
  );
  if (actualOrder.length !== expected.length) {
    return {
      ok: false,
      reason: `ordering length mismatch: expected ${expected.length} events, DO applied ${actualOrder.length}`,
    };
  }
  for (let i = 0; i < expected.length; i++) {
    if (actualOrder[i] !== expected[i]) {
      return {
        ok: false,
        reason: `ordering divergence at index ${i}: expected ${expected[i]}, DO applied ${actualOrder[i]}`,
      };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Playwright-bound primitives — SIGNATURES ONLY
//
// The bindings cannot land until agar/ has a real DO + ws (slice agar-01).
// Their TYPES land here so the spec file can compile against the contract,
// and so the slice that binds them has a target shape to satisfy.
// ---------------------------------------------------------------------------

/** Opaque Playwright Page type — kept abstract here so this file has zero
 *  @playwright/test dependency. The binding module re-exports these with
 *  the real `Page` substituted in. */
export interface PageLike {
  readonly __pageLike: unique symbol;
}

/** Apply `tape` to N pages, advancing simulated time. No wallclock waits;
 *  the DO is contracted to expose a `tickTo(n)` test hook the binding
 *  drives. `seed` is forwarded to the DO at match-start. */
export type DriveTape = <TInput>(
  pages: readonly PageLike[],
  tape: Tape<TInput>,
  opts: { readonly seed: number },
) => Promise<void>;

/** Read `window.__game.canonical` from a page AFTER quiescing on a
 *  deterministic tick boundary (NOT wallclock; that reintroduces flake). */
export type ReadCanonical = <TState>(page: PageLike) => Promise<TState>;

/** Structural-equality assertion across N pages. Uses `structuralEquals`
 *  by default; pass a custom predicate (e.g. `withFloatTolerance(1e-6)`)
 *  when physics drift is contractually tolerated. */
export type ExpectConverge = <TState>(
  pages: readonly PageLike[],
  predicate?: (a: unknown, b: unknown) => boolean,
) => Promise<void>;

/** Controlled network partition. `disconnect` drops the page's ws
 *  connection while keeping the page itself alive; `reconnect` restores
 *  it and asserts the DO replays missed state up to the current tick. */
export type Disconnect = (page: PageLike) => Promise<void>;
export type Reconnect = (page: PageLike) => Promise<void>;

/** The full harness surface — what the binding module exports and what
 *  spec files import. */
export interface MultiplayerHarness {
  readonly driveTape: DriveTape;
  readonly canonical: ReadCanonical;
  readonly expectConverge: ExpectConverge;
  readonly disconnect: Disconnect;
  readonly reconnect: Reconnect;
}

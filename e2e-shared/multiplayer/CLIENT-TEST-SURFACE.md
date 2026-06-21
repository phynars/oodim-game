# `window.__game` — the client test-surface contract (Refs #129, #178, #179, #180)

This document specifies the **DOM-side test surface** every multiplayer
game's client must expose for the shared harness primitives in
`e2e-shared/multiplayer/harness.ts` to drive it. It is filed **before
agar-01 (#178) lands** so the first DO+ws slice does not invent an
ad-hoc shape that the binding later has to apologize for.

If you arrive here from #178 / #179 / #180 looking for "what does the
spec read off `page` to make a convergence / ordering / reconnect
assertion?" — this file is the answer.

## Why land this before any client code

The harness already ships its pure primitives (`orderTape`,
`pureReplay`, `structuralEquals`, `withFloatTolerance`,
`assertOrderingInvariant`) and the **signatures** of the Playwright-
bound primitives (`DriveTape`, `ReadCanonical`, `ExpectConverge`,
`Disconnect`, `Reconnect`). Those signatures bottom out in
`page.evaluate(() => window.__game....)`. What `window.__game` actually
exposes is the load-bearing seam between every multiplayer game's
client and the shared harness — and it has not been written down.

Without this doc, the agar-01 implementer chooses an ad-hoc shape
(`window.agar`, `window.gameState`, `window.canonical`, etc.) and the
binding module either matches that ad-hoc shape (locking the harness
to agar's accidents) or asks for a rename PR later (slower + risks
drift). The harness's whole premise is **one harness, N games**; the
test surface is the joint that makes N > 1 cheap. Write it once,
land it before anyone touches client code.

## The contract

Every multiplayer game's client MUST install, at boot, exactly one
global object at `window.__game` shaped as below. The harness reads
**only** these fields; the game may add more for its own debugging,
but the harness will never depend on them.

```ts
// Shipped at runtime on the client. NOT a TS type the game imports —
// it's a structural contract enforced by the harness reading these
// fields. Document the shape in each game's client entry near where
// the object is installed.
interface WindowGameTestSurface {
  // ---------------- READ surface (harness reads) ----------------

  /** Canonical authoritative state, as last received from the server
   *  (or, for echo-only slices like agar-01, the last echoed payload).
   *  MUST be a plain JSON-ish object — no class instances, no Maps,
   *  no Sets, no Dates, no functions. `structuralEquals` from the
   *  shared harness is the equality predicate; if you need float
   *  tolerance, the spec wraps it in `withFloatTolerance(epsilon)`.
   *  Updated synchronously on every server snapshot. */
  readonly canonical: unknown;

  /** Monotonically-increasing tick number the canonical above
   *  reflects. Used by the harness to await quiescence on a
   *  deterministic tick boundary instead of a wallclock timer.
   *  For echo-only slices (agar-01) this is allowed to stay at 0
   *  — but the field MUST exist. */
  readonly tick: number;

  /** Ordered list of event keys (`${tick}:${clientId}:${seq}`) the
   *  server reports it applied, in apply order. The
   *  ordering-invariant assertion (#129 assertion 3) compares this
   *  against `orderTape(tape).map(key)`. For echo-only slices, an
   *  empty array is acceptable — but the field MUST exist. */
  readonly appliedOrder: readonly string[];

  /** Connection liveness. The harness awaits `ready === true` after
   *  navigation and after `reconnect()` calls. */
  readonly ready: boolean;

  // ---------------- DRIVE surface (harness calls) ----------------

  /** Apply one tape event from the harness's perspective. The client
   *  forwards it to the server via ws and resolves the returned
   *  promise when the server's ack/echo arrives. Used by
   *  `driveTape()` so spec files do not need to know the wire
   *  format. */
  readonly sendInput: (event: {
    readonly tick: number;
    readonly clientId: string;
    readonly seq: number;
    readonly input: unknown;
  }) => Promise<void>;

  /** Advance the server's tick to `n` (test-only hook). For agar-01
   *  echo, this is a no-op resolved immediately. For agar-02+ the
   *  server MUST expose a deterministic tickTo so the harness never
   *  needs `waitForTimeout`. */
  readonly tickTo: (n: number) => Promise<void>;

  /** Drop the ws connection while leaving the page alive. Used by
   *  `harness.disconnect(page)`. Subsequent `sendInput` calls MUST
   *  reject until `reconnect()` resolves. */
  readonly disconnect: () => Promise<void>;

  /** Restore the ws connection. Resolves once `ready === true` AND
   *  any missed server state has been replayed up to the current
   *  canonical tick. Used by `harness.reconnect(page)`. */
  readonly reconnect: () => Promise<void>;
}

declare global {
  interface Window {
    __game?: WindowGameTestSurface;
  }
}
```

## Why these exact fields

- **`canonical`** and **`tick`** together let the harness express "the
  client has seen the server's state as of tick N" without a timer.
  Convergence is `structuralEquals(pageA.canonical, pageB.canonical)`
  after both have ticked to the same N. (#129 assertion 2.)
- **`appliedOrder`** is what `assertOrderingInvariant(tape, actual)`
  consumes. Without it, the ordering invariant degrades to "the final
  state matches" — which is a weaker assertion that misses reorderings
  that happen to commute on this specific tape. (#129 assertion 3.)
- **`sendInput`** + **`tickTo`** replace `waitForTimeout` with explicit
  causal awaits. The harness's "no wallclock waits" rule is enforced
  by the spec-author: if your spec needs `waitForTimeout`, the
  test-surface is missing a hook — file an issue, don't paper over it.
- **`disconnect`** / **`reconnect`** are the seam for the
  reconnect-replay assertion (#129 assertion 4). The fixture
  `reconnect-amnesia` mode in `FIXTURE-DESYNC-BROKEN.md` is the
  failing-on-unfixed gate for this seam.

## What this means for each open agar slice

- **#178 (agar-01, DO+ws echo).** Install `window.__game` with
  `canonical`, `tick=0`, `appliedOrder=[]`, `ready`, `sendInput` (echo
  round-trip), `tickTo` (no-op), `disconnect`, `reconnect`. The
  single-client e2e drives one `sendInput` and asserts the echoed
  payload appears in `canonical`. No new shape; the harness binding
  module that lands alongside agar-01 will resolve its types against
  this contract.
- **#179 (agar-02, 20Hz tick + snapshot).** `tick` starts
  monotonically increasing; `appliedOrder` populates; `tickTo` becomes
  a real hook on the DO. Same contract, no shape change — that's the
  point.
- **#180 (agar-03, two-client convergence).** The spec opens two
  contexts, calls `driveTape` (which under the hood calls
  `page.evaluate(e => window.__game.sendInput(e), ...)` on the right
  page per event), then `expectConverge([pageA, pageB])` reads
  `canonical` from both. `AGAR_DO_BREAK_MODE` (see
  `FIXTURE-DESYNC-BROKEN.md`) flips the DO's behavior under each of
  the four modes; the contract above does not change.

## Non-goals

- **Not a public API.** `window.__game` is a TEST surface — production
  builds may still install it (cheap), but no game UI code should read
  from it. If game UI reads from it, that's drift the contract didn't
  intend; file an issue.
- **Not a state-management library.** The contract specifies a tiny
  reading surface and a small command surface, nothing else. The game
  may keep its real state wherever it wants; `window.__game.canonical`
  is a projection.
- **No types-package yet.** The shape is small enough that duplicating
  the interface in each game's client and in the harness binding is
  cheaper than a new shared `@oodim/multiplayer-types` package. If a
  third multiplayer game lands and the shape has stabilized, promote
  it then.

## Failure mode this prevents

Without this doc, the agar-01 client will install `window.agar`. The
agar-02 client will rename it to `window.__agar`. The agar-03 spec
will read `window.__agar.state` not realizing pacman/galaga harness
test specs (if/when they grow multiplayer) need the same hook under
a different prefix, and we end up with `page.evaluate` indirections
sprinkled through each game's e2e. That's exactly the per-game
clone-and-drift the harness was created to prevent (#129's "second
multiplayer game must reuse them as-is" clause).

Refs #129 · Refs #130 · Refs #178 · Refs #179 · Refs #180.

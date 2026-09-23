/**
 * A short, cancel-safe acknowledgement for the irreversible packet decision.
 * The caller supplies the rendered choice element; this module deliberately owns
 * no story state, so a visual acknowledgement cannot cause a different choice.
 *
 * Wired into `aftersign/main.js:commitPacketOutcome` behind a try/catch so any
 * feedback exception can never block the durable choice commit.
 *
 * Extension-resolution contract: this file has ZERO relative imports; the
 * `.test.ts` shim's sole relative import (`./packetChoiceIntentFeedback.ts`)
 * is `.ts`-extensioned, matching every sibling *Feedback module in this
 * directory (routeChoicePressFeedback.ts, targetLossFeedback.ts,
 * failureStingFeedback.ts, recognitionFeedback.ts). The prior draft used a
 * `.js` leaf; Soren (PR #1902, AI008) flagged that the `.ts`-imports-`.js`
 * shape needs `allowJs` or a `.d.ts`, and the owning `aftersign/tsconfig.json`
 * has neither (`strict: true`, no `allowJs`). Renaming the leaf to `.ts` is
 * the mechanical fix — same runtime behaviour under `--experimental-strip-types`,
 * types now visible to the blocking `typecheck:aftersign` gate.
 *
 * Runtime consumer: `aftersign/main.js` imports this file at
 * `./src/packetChoiceIntentFeedback.ts`. Vite resolves `.ts` from a `.js`
 * ES module import in dev/build (siblings `routeChoicePressFeedback.ts` and
 * `targetLossFeedback.ts` are consumed the same way from main.js — verified
 * in this same PR's diff and in prior PR #1806).
 */

interface AckElement {
  style: {
    transition: string;
    transform: string;
    filter: string;
    [key: string]: string;
  };
}

interface PlayOptions {
  reducedMotion?: boolean;
}

export const PACKET_CHOICE_ACK_MS = 180;

// Style keys the ack module mutates. Kept in one place so both playback and
// reset touch the same set; also lets `checkPacketChoiceIntentFeedback` assert
// EVERY prior is restored (not just the ones the current implementation
// happens to remember).
const ACK_STYLE_KEYS = ["transition", "transform", "filter"] as const;

export function playPacketChoiceIntentFeedback(
  element: AckElement | null | undefined,
  { reducedMotion = false }: PlayOptions = {},
): () => void {
  if (!element) return () => {};

  const priors: Record<string, string> = {};
  for (const key of ACK_STYLE_KEYS) priors[key] = element.style[key];
  let timer = 0;

  const reset = (): void => {
    if (timer) {
      // `window.clearTimeout` matches the `window.setTimeout` we scheduled,
      // so a bare `clearTimeout` reference (missing in some test doubles)
      // isn't required. If the caller invokes `reset()` before the timer
      // fires we cancel; if it invokes after, `timer` was already zeroed
      // by the timer body below and we no-op.
      if (typeof window !== "undefined" && typeof window.clearTimeout === "function") {
        window.clearTimeout(timer);
      } else if (typeof clearTimeout === "function") {
        clearTimeout(timer);
      }
    }
    timer = 0;
    for (const key of ACK_STYLE_KEYS) element.style[key] = priors[key];
  };

  if (reducedMotion) {
    // Brightness-only: no motion, no transition. Players who asked the OS to
    // reduce motion get an unambiguous static ack.
    element.style.filter = "brightness(1.18)";
  } else {
    element.style.transition = "transform 70ms ease-out, filter 70ms ease-out";
    element.style.transform = "translateY(-2px) scale(1.02)";
    element.style.filter = "brightness(1.12)";
  }

  const schedule: (fn: () => void, delay: number) => number =
    typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? (fn, delay) => window.setTimeout(fn, delay) as unknown as number
      : (fn, delay) => setTimeout(fn, delay) as unknown as number;
  timer = schedule(() => {
    // Body: same reset, but zero `timer` FIRST so a nested `reset()` call
    // from the timer thread doesn't double-clear a re-used id.
    const t = timer;
    timer = 0;
    if (t) {
      // no-op: `t` is our own id; nothing external to clear.
    }
    for (const key of ACK_STYLE_KEYS) element.style[key] = priors[key];
  }, PACKET_CHOICE_ACK_MS);

  return reset;
}

// ---------------------------------------------------------------------------
// Pure-runner check bundle.
//
// The earlier draft only asserted `PACKET_CHOICE_ACK_MS <= 200 && > 0` against
// the same hardcoded `180` in this file — a tautology that couldn't fail for
// any real bug (Soren, PR #1902, AI003). These checks drive
// `playPacketChoiceIntentFeedback` against a tiny element stub and pin the
// OBSERVABLE playback behaviour: null-element early-out, prior-style
// restoration, the reduced-motion branch collapses to brightness only, the
// non-reduced branch stamps a transform, and the timer fires the reset
// automatically at `PACKET_CHOICE_ACK_MS`.
// ---------------------------------------------------------------------------

interface ElementStubInit {
  transition?: string;
  transform?: string;
  filter?: string;
}

function makeElementStub(initial: ElementStubInit = {}): AckElement {
  return {
    style: {
      transition: initial.transition ?? "",
      transform: initial.transform ?? "",
      filter: initial.filter ?? "",
    },
  };
}

interface FakeTimers {
  advance: () => void;
  pending: () => number;
  lastDelay: () => number | null;
}

function withFakeTimers<T>(body: (timers: FakeTimers) => T): T {
  const scheduled: Array<{ id: number; fn: () => void; delay: number }> = [];
  let nextId = 1;
  const realWindow = typeof window === "undefined" ? undefined : window;
  const fakeWindow = {
    setTimeout: (fn: () => void, delay: number): number => {
      const id = nextId++;
      scheduled.push({ id, fn, delay });
      return id;
    },
    clearTimeout: (id: number): void => {
      const idx = scheduled.findIndex((entry) => entry.id === id);
      if (idx >= 0) scheduled.splice(idx, 1);
    },
    matchMedia: (): { matches: boolean } => ({ matches: false }),
  };
  // Install fake window for the duration of `body`. The module code guards
  // `typeof window !== "undefined"`, so overwriting the global is enough.
  (globalThis as unknown as { window: unknown }).window = fakeWindow;
  try {
    return body({
      advance: () => {
        // Fire every pending timer once, in FIFO order. Handlers may push
        // more; those run on the next `advance()` call.
        const batch = scheduled.splice(0);
        for (const entry of batch) entry.fn();
      },
      pending: () => scheduled.length,
      lastDelay: () => (scheduled.length ? scheduled[scheduled.length - 1].delay : null),
    });
  } finally {
    if (realWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
    else (globalThis as unknown as { window: unknown }).window = realWindow;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

export function checkPacketChoiceIntentFeedback(): void {
  // (0) Constant sanity — kept as a lightweight sibling pin, not the whole
  //     bundle. `PACKET_CHOICE_ACK_MS` must be finite and fit inside the
  //     "immediate ack" budget the wire-in comment in main.js promises.
  assertTrue(PACKET_CHOICE_ACK_MS > 0, "PACKET_CHOICE_ACK_MS must be a finite positive duration");
  assertTrue(
    PACKET_CHOICE_ACK_MS <= 200,
    "PACKET_CHOICE_ACK_MS must stay inside the ≤200ms immediate-ack budget",
  );

  // (1) Null-element early-out — commitPacketOutcome relies on this: if the
  //     button ref is stale, playback must return a no-op cancel fn without
  //     throwing (the try/catch in main.js would swallow a throw, but a
  //     silent no-op is the contract).
  withFakeTimers((timers) => {
    const nullCancel = playPacketChoiceIntentFeedback(null);
    assertEqual(typeof nullCancel, "function", "Null element must yield a no-op cancel function");
    nullCancel(); // must not throw
    assertEqual(timers.pending(), 0, "Null-element playback must not schedule a timer");

    // (2) Non-reduced-motion branch stamps transform + transition + filter.
    const el = makeElementStub({ transition: "orig-t", transform: "orig-x", filter: "orig-f" });
    const cancel = playPacketChoiceIntentFeedback(el, { reducedMotion: false });
    assertTrue(el.style.transform.length > 0, "Non-reduced branch must stamp a transform");
    assertTrue(
      el.style.transform !== "orig-x",
      "Non-reduced branch must overwrite the prior transform (not leave it as-is)",
    );
    assertTrue(el.style.filter.length > 0, "Non-reduced branch must stamp a filter");
    assertTrue(el.style.transition.length > 0, "Non-reduced branch must stamp a transition");
    assertEqual(timers.pending(), 1, "Non-reduced playback must schedule exactly one release timer");
    assertEqual(
      timers.lastDelay(),
      PACKET_CHOICE_ACK_MS,
      "Release timer must fire at PACKET_CHOICE_ACK_MS, not some other window",
    );

    // (3) Manual cancel restores every prior style — this is the try/catch
    //     safety net in main.js: if a re-entrant commit fires, the caller
    //     can cancel and the button must go back to exactly where it was.
    cancel();
    assertEqual(el.style.transition, "orig-t", "Cancel must restore prior transition");
    assertEqual(el.style.transform, "orig-x", "Cancel must restore prior transform");
    assertEqual(el.style.filter, "orig-f", "Cancel must restore prior filter");
    assertEqual(timers.pending(), 0, "Cancel must clear the scheduled release timer");

    // (4) Timer-driven release restores every prior style with no manual
    //     cancel — this is the common path (player commits, ack fades on
    //     its own).
    const el2 = makeElementStub({ transition: "t2", transform: "x2", filter: "f2" });
    playPacketChoiceIntentFeedback(el2, { reducedMotion: false });
    assertTrue(el2.style.transform !== "x2", "Playback must overwrite prior transform before timer fires");
    timers.advance();
    assertEqual(el2.style.transition, "t2", "Timer release must restore prior transition");
    assertEqual(el2.style.transform, "x2", "Timer release must restore prior transform");
    assertEqual(el2.style.filter, "f2", "Timer release must restore prior filter");

    // (5) Reduced-motion branch is brightness-only: no transform, no
    //     transition — the reduced-motion promise in the wire-in comment.
    const el3 = makeElementStub({ transition: "keep-t", transform: "keep-x", filter: "keep-f" });
    playPacketChoiceIntentFeedback(el3, { reducedMotion: true });
    assertEqual(
      el3.style.transform,
      "keep-x",
      "Reduced-motion branch must not stamp a transform (motion is what the OS said not to do)",
    );
    assertEqual(
      el3.style.transition,
      "keep-t",
      "Reduced-motion branch must not stamp a transition (no motion, no easing curve)",
    );
    assertTrue(
      el3.style.filter !== "keep-f",
      "Reduced-motion branch must still stamp a brightness ack — silent commits are worse than motionless ones",
    );
    assertEqual(timers.pending(), 1, "Reduced-motion playback must also schedule a release timer");
    timers.advance();
    assertEqual(el3.style.filter, "keep-f", "Reduced-motion timer release must restore prior filter");
  });
}

export function runPacketChoiceIntentFeedbackChecks(): void {
  checkPacketChoiceIntentFeedback();
}

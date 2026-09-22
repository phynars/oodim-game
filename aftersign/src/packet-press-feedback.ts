// Packet-press logic-side feedback envelope (PR #1879).
//
// The pure state-machine that `packetPress(input)` in
// `aftersign/main.js` drives on every controller press. Distinct from
// the pointer-driven `#packetButton[data-aftersign-packet-press="pressing"]`
// envelope (owned by `aftersign/packetOfferPressing.js`, held for
// `--aftersign-packet-press-hold-ms`): that one paints the raw finger
// contact; THIS one paints the logic side — `packetPress` fired,
// controller acknowledged the press, feedback held for the visual
// window regardless of contact duration. Different attribute
// (`data-packet-press-feedback="pressed"` vs
// `data-aftersign-packet-press="pressing"`) so the two envelopes stack
// without collision.
//
// This module is the SOURCE OF TRUTH for `PACKET_PRESS_FEEDBACK_MS`.
// Three consumers mirror it:
//   1. `aftersign/main.js` — imports `beginPacketPressFeedback` /
//      `advancePacketPressFeedback` and drives the rAF-ticked
//      `packetPressFeedback` state; stamps `data-packet-press-feedback`
//      on `#packetButton` on every render.
//   2. `aftersign/index.html` — CSS consumer rule on
//      `#packetButton[data-packet-press-feedback="pressed"]` reads the
//      `--aftersign-packet-press-feedback-*` :root vars whose numeric
//      values mirror `PACKET_PRESS_FEEDBACK_MS`.
//   3. `aftersign/packetPressFeedbackServedContract.ts` — pure-runner
//      contract that reds the pure lane if either drifts from this file.
//
// Extension-resolution contract: this file has ZERO relative imports;
// the `.test.ts` shim's sole relative import (`./packet-press-feedback.ts`)
// is `.ts`-extensioned. The pure-runner (`node --experimental-strip-types`)
// resolves the whole subgraph deterministically.

export const PACKET_PRESS_FEEDBACK_MS = 92;

export type PacketPressFeedback = {
  isPressed: boolean;
  releaseAtMs: number | null;
};

export const IDLE_PACKET_PRESS_FEEDBACK: PacketPressFeedback = {
  isPressed: false,
  releaseAtMs: null,
};

export function beginPacketPressFeedback(nowMs: number): PacketPressFeedback {
  return {
    isPressed: true,
    releaseAtMs: nowMs + PACKET_PRESS_FEEDBACK_MS,
  };
}

export function advancePacketPressFeedback(
  feedback: PacketPressFeedback,
  nowMs: number,
): PacketPressFeedback {
  if (!feedback.isPressed || feedback.releaseAtMs === null || nowMs < feedback.releaseAtMs) {
    return feedback;
  }

  return { isPressed: false, releaseAtMs: null };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

// Pins the VISUAL CONTRACT `packetPress` promises the player, not a
// restatement of the arithmetic inside `beginPacketPressFeedback`
// (which the earlier draft did — `releaseAtMs === nowMs + 92` reads
// the same equation back out of the returned struct). The new pins
// key off observable-at-render properties: (a) a press stamps the
// `pressed` state on the very first frame, (b) the state survives at
// least one 60Hz frame after begin (~16.7ms) so the CSS transition
// has a target to paint toward, (c) the state is still `pressed`
// strictly inside the window `[begin, begin + PACKET_PRESS_FEEDBACK_MS)`,
// (d) the state releases exactly at the boundary, and
// (e) the state stays released beyond the boundary (rAF-safe:
// `advance` is idempotent once released).
export function checkPacketPressFeedback(): void {
  // Idle-shape guard: fresh state renders as `idle` — no leftover
  // `pressed` from a previous slice.
  assertEqual(
    IDLE_PACKET_PRESS_FEEDBACK.isPressed,
    false,
    "IDLE_PACKET_PRESS_FEEDBACK must render the button as idle",
  );

  // (a) Immediate-stamp guard: a press at t=0 lands the `pressed`
  // state before rAF has a chance to advance. This is what
  // `renderPacketPressFeedback` in main.js reads on the frame that
  // called `packetPress`.
  const pressed = beginPacketPressFeedback(1_000);
  assertTrue(
    pressed.isPressed,
    "A packet press must stamp `pressed` on the first frame — no one-frame gap between input and paint",
  );

  // (b) One-frame-hold guard: 60Hz frame is ~16.667ms. At one frame
  // after begin, the envelope must still be `pressed` — otherwise the
  // CSS transition never has a target to paint toward.
  assertTrue(
    advancePacketPressFeedback(pressed, 1_000 + 16.667).isPressed,
    "Packet press feedback must survive the first 60Hz frame after press",
  );

  // (c) Strict-interior guard: at any moment strictly inside the
  // window, the state stays `pressed`. Uses `PACKET_PRESS_FEEDBACK_MS`
  // so a `MS: 92 → 108` edit re-shapes this pin (not a hard-coded
  // 1_091 that stays green after the constant moves — the tautology
  // the prior draft shipped).
  const midWindow = 1_000 + PACKET_PRESS_FEEDBACK_MS / 2;
  assertTrue(
    advancePacketPressFeedback(pressed, midWindow).isPressed,
    "Packet press feedback must still be `pressed` at the halfway point of its window",
  );

  // (d) Boundary-release guard: at exactly `begin + MS`, the state
  // flips to `idle` and forgets its `releaseAtMs`.
  const atBoundary = advancePacketPressFeedback(pressed, 1_000 + PACKET_PRESS_FEEDBACK_MS);
  assertEqual(atBoundary.isPressed, false, "Packet press feedback must release at its window boundary");
  assertEqual(
    atBoundary.releaseAtMs,
    null,
    "Released packet press feedback must clear its releaseAtMs so a follow-up press restarts cleanly",
  );

  // (e) Idempotent-post-release guard: rAF may not tick again for
  // frames after the release lands; the state must stay `idle`
  // through any subsequent `advance` call so a stray tick doesn't
  // resurrect `pressed`.
  const long = advancePacketPressFeedback(atBoundary, 1_000 + PACKET_PRESS_FEEDBACK_MS * 4);
  assertEqual(long.isPressed, false, "Released packet press feedback must stay released across further advances");

  // (f) Guarantee `PACKET_PRESS_FEEDBACK_MS` sits at least one 60Hz
  // frame past a full frame — otherwise the CSS transition can't
  // land its target. This is a REAL constraint on the constant, not
  // a restatement of it.
  assertTrue(
    PACKET_PRESS_FEEDBACK_MS >= 32,
    "PACKET_PRESS_FEEDBACK_MS must span at least two 60Hz frames so the paint envelope is visible",
  );
}

export function runPacketPressFeedbackChecks(): void {
  checkPacketPressFeedback();
}

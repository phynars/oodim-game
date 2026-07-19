/**
 * AFTERSIGN vertical-slice feel primitive: the sealed packet choice.
 *
 * SINGLE SOURCE OF TRUTH. This is the live packet-intent controller wired
 * via `aftersign/index.html` into `window.__game`. It replaces the old
 * `aftersign/packet-intent.js` (deleted in the same change that ported it
 * to TypeScript — see `docs/ops/2026-07-packet-intent-consolidation.md`).
 *
 * The module is intentionally dependency-free so the WebGL/headless harness
 * can run it before the three.js scene exists. The scene feeds pointer /
 * keyboard / touch input into this controller and exposes the resulting
 * state through `window.__game`.
 *
 * Feel contract (pinned by both this module's checks and
 * `aftersign/e2e/packet-hold-threshold.spec.ts`):
 *   - 450 ms hold threshold ("long enough to reject accidents, short enough
 *     to avoid drag")
 *   - pre-break feedback begins by 120 ms into hold
 *   - anything under 180 ms of hold-and-release is a tap that preserves the
 *     seal
 *   - releasing in the 181–449 ms in-bounds window ALSO preserves the seal;
 *     this is the anti-punitive-dead-zone contract — a false-sealed is
 *     recoverable (press again), a false-opened spends trust
 *   - dragging beyond 14 px from the press point cancels
 *   - drift-cancel is sticky: once CANCELLED, subsequent tick()s cannot
 *     resurrect OPENED
 */

export const PACKET_INTENT = Object.freeze({
  HOLD_TO_OPEN_MS: 450,
  TAP_TO_PRESERVE_MAX_MS: 180,
  DRIFT_CANCEL_PX: 14,
  PROGRESS_DEADBAND_MS: 80,
});

export type PacketIntentConfig = {
  HOLD_TO_OPEN_MS: number;
  TAP_TO_PRESERVE_MAX_MS: number;
  DRIFT_CANCEL_PX: number;
  PROGRESS_DEADBAND_MS: number;
};

export const PACKET_OUTCOME = Object.freeze({
  UNKNOWN: "unknown",
  SEALED: "sealed",
  OPENED: "opened",
  CANCELLED: "cancelled",
} as const);

export type PacketOutcome = (typeof PACKET_OUTCOME)[keyof typeof PACKET_OUTCOME];

export interface PacketIntentPoint {
  x: number;
  y: number;
}

export interface PacketIntentPressInput extends PacketIntentPoint {
  timeMs: number;
}

export interface PacketIntentSnapshot {
  active: boolean;
  outcome: PacketOutcome;
  progress: number;
  config: PacketIntentConfig;
}

export interface PacketIntentTickOptions {
  hasFocus?: boolean;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function distancePx(a: PacketIntentPoint, b: PacketIntentPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Converts raw press/release input into one explicit packet choice.
 *
 * See file header for the feel contract.
 */
export class PacketIntentController {
  public readonly config: PacketIntentConfig;
  public active: boolean;
  public startTimeMs: number;
  public startPoint: PacketIntentPoint;
  public lastPoint: PacketIntentPoint;
  public outcome: PacketOutcome;
  public progress: number;
  /**
   * Wall-clock time at which the hidden interval STARTED — i.e. the last
   * focused advance the controller observed before losing focus. `null`
   * while the gesture is currently focused. On the next focused tick we
   * shift `startTimeMs` forward by `(timeMs - hiddenAtMs)` so the full
   * hidden interval — from the last focused advance up to resume — is
   * excluded from the hold clock.
   *
   * IMPORTANT: this is stamped from `lastAdvanceMs`, NOT from the hidden
   * tick's own timestamp. The hidden tick itself may arrive an arbitrary
   * time after focus was actually lost (visibility events don't guarantee
   * an immediate tick), so using the hidden tick's clock would leave a
   * gap of unaccounted wall-clock that the resume tick then reads as
   * "held" and silently commits OPENED — see #714 and the PR-review fix
   * (`checkBackgroundTickCannotOpenPacket`).
   */
  public hiddenAtMs: number | null;
  /**
   * Timestamp of the most recent focused advance (`press` / focused `tick`
   * / `move` / `release`). Used to anchor `hiddenAtMs` when focus is lost
   * so the ENTIRE gap between last-focused-advance and resume is shifted
   * out of the hold clock. Without this anchor, `hiddenAtMs` would stamp
   * at the hidden tick's own clock and only subtract the sliver between
   * the hidden tick and resume — leaving the pre-hidden-tick gap counted
   * as held (bug fixed by #714's re-review).
   */
  public lastAdvanceMs: number;

  constructor(config: Partial<PacketIntentConfig> = {}) {
    this.config = { ...PACKET_INTENT, ...config };
    this.active = false;
    this.startTimeMs = 0;
    this.startPoint = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
    this.hiddenAtMs = null;
    this.lastAdvanceMs = 0;
  }

  reset(): PacketIntentSnapshot {
    this.active = false;
    this.startTimeMs = 0;
    this.startPoint = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
    this.hiddenAtMs = null;
    this.lastAdvanceMs = 0;
    return this.snapshot();
  }

  press(input: PacketIntentPressInput): PacketIntentSnapshot {
    this.active = true;
    this.startTimeMs = input.timeMs;
    this.startPoint = { x: input.x, y: input.y };
    this.lastPoint = { x: input.x, y: input.y };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
    this.hiddenAtMs = null;
    // Anchor for the hidden-interval calculation. Until the first focused
    // tick advances this, the press time itself stands in as "last known
    // focused moment" — correct: if the tab is hidden immediately after
    // press, we credit zero held time.
    this.lastAdvanceMs = input.timeMs;
    return this.snapshot();
  }

  move(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    // A pointer move implies the tab is focused enough to receive input, so
    // resolve any pending hidden interval before we advance progress.
    this.consumeHiddenInterval(input.timeMs);
    this.lastPoint = { x: input.x, y: input.y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
      this.active = false;
      this.progress = 0;
      return this.snapshot();
    }

    this.advanceProgress(input.timeMs);
    this.lastAdvanceMs = input.timeMs;
    return this.snapshot();
  }

  /**
   * Advance the hold clock without any pointer move. Primary open path on
   * mouse and touch: the player presses and holds without wiggling, and
   * the packet must still open at HOLD_TO_OPEN_MS. Scene tick / rAF loop
   * should call this every frame while `active` is true.
   */
  tick(timeMs: number, options: PacketIntentTickOptions = {}): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    if (options.hasFocus === false) {
      // Freeze progress and STAMP hiddenAtMs at `lastAdvanceMs`, not the
      // hidden tick's own clock. The hidden tick can arrive an arbitrary
      // wall-clock delta after focus was actually lost (rAF pauses when
      // hidden; `visibilitychange` fires whenever the browser gets around
      // to it). Anchoring on the last focused advance means the entire
      // pre-hidden-tick gap is credited as hidden, not as held — which is
      // the actual fix for #714 (the resume tick otherwise reads that gap
      // as hold time and commits OPENED).
      if (this.hiddenAtMs === null) this.hiddenAtMs = this.lastAdvanceMs;
      return this.snapshot();
    }
    // Focused tick: if we were hidden, shift `startTimeMs` forward by the
    // hidden duration so the hold clock only counts focused time. Then
    // advance normally.
    this.consumeHiddenInterval(timeMs);
    this.advanceProgress(timeMs);
    this.lastAdvanceMs = timeMs;
    return this.snapshot();
  }

  release(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    // If the release fires straight out of a hidden interval (e.g. the tab
    // was backgrounded, the pointer was released on resume), the accumulated
    // hidden duration must not count toward the hold — otherwise a
    // background pause + on-resume release commits OPENED. #714.
    this.consumeHiddenInterval(input.timeMs);
    this.lastPoint = { x: input.x, y: input.y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
    } else {
      const heldMs = input.timeMs - this.startTimeMs;
      // Releasing before full commit keeps the packet sealed.
      // Anti-punitive-dead-zone contract: 181–449 ms in-bounds release must
      // be SEALED, not CANCELLED. A false-sealed is recoverable (press
      // again); a false-opened spends trust.
      this.outcome =
        heldMs < this.config.HOLD_TO_OPEN_MS
          ? PACKET_OUTCOME.SEALED
          : PACKET_OUTCOME.OPENED;
    }

    this.active = false;
    this.progress = 0;
    return this.snapshot();
  }

  isCommitted(): boolean {
    return this.outcome !== PACKET_OUTCOME.UNKNOWN;
  }

  openProgressAt(timeMs: number): number {
    if (!this.active) return 0;
    const heldMs = Math.max(
      0,
      timeMs - this.startTimeMs - this.config.PROGRESS_DEADBAND_MS,
    );
    const usableMs = this.config.HOLD_TO_OPEN_MS - this.config.PROGRESS_DEADBAND_MS;
    return clamp01(heldMs / usableMs);
  }

  snapshot(): PacketIntentSnapshot {
    return {
      active: this.active,
      outcome: this.outcome,
      progress: this.progress,
      config: this.config,
    };
  }

  private advanceProgress(timeMs: number): void {
    this.progress = this.openProgressAt(timeMs);
    if (this.progress >= 1) {
      this.outcome = PACKET_OUTCOME.OPENED;
      this.active = false;
    }
  }

  /**
   * If we accumulated a hidden interval (`hiddenAtMs` was set by a
   * `hasFocus:false` tick), shift `startTimeMs` forward by that duration
   * so the hold clock resumes from the moment focus returned. Clears the
   * pending interval. Safe to call unconditionally — it's a no-op when
   * no interval is pending.
   */
  private consumeHiddenInterval(timeMs: number): void {
    if (this.hiddenAtMs === null) return;
    const hiddenMs = Math.max(0, timeMs - this.hiddenAtMs);
    this.startTimeMs += hiddenMs;
    this.hiddenAtMs = null;
  }
}

/**
 * Thin story-state adapter used by the WebGL/headless harness. Mirrors the
 * controller's outcome into a flat `state` object that `window.__game`
 * exposes. Kept in this file so the harness can be constructed from a
 * single import.
 */
export interface PacketIntentHarnessState {
  packetOutcome: PacketOutcome;
  packetOpenProgress: number;
}

export interface PacketIntentHarness {
  readonly state: PacketIntentHarnessState;
  press(input: PacketIntentPressInput): PacketIntentHarnessState;
  move(input: PacketIntentPressInput): PacketIntentHarnessState;
  tick(timeMs: number, options?: PacketIntentTickOptions): PacketIntentHarnessState;
  release(input: PacketIntentPressInput): PacketIntentHarnessState;
  reset(): PacketIntentHarnessState;
}

export function createPacketIntentHarness(): PacketIntentHarness {
  const controller = new PacketIntentController();
  const state: PacketIntentHarnessState = {
    packetOutcome: PACKET_OUTCOME.UNKNOWN,
    packetOpenProgress: 0,
  };

  function sync(snapshot: PacketIntentSnapshot): PacketIntentHarnessState {
    state.packetOutcome = snapshot.outcome;
    state.packetOpenProgress = snapshot.progress;
    return state;
  }

  return {
    state,
    press(input) {
      return sync(controller.press(input));
    },
    move(input) {
      return sync(controller.move(input));
    },
    tick(timeMs, options) {
      return sync(controller.tick(timeMs, options));
    },
    release(input) {
      return sync(controller.release(input));
    },
    reset() {
      return sync(controller.reset());
    },
  };
}

/**
 * Runs the parity checks that pin the feel contract.
 *
 * These mirror the assertions in `aftersign/e2e/packet-hold-threshold.spec.ts`
 * one layer down (controller-only, no scene / window.__game). If either the
 * controller or the E2E drifts, one of these fails first.
 *
 * Ported from the deleted `aftersign/packet-intent.test.js` — every scenario
 * that file covered is covered here, using the strict `unknown` (not `null`)
 * uncommitted sentinel that the controller actually returns.
 */
export function runPacketIntentChecks(): void {
  checkShortTapPreservesSeal();
  checkDeadzoneReleasePreservesSeal();
  checkNearMissReleasePreservesSeal();
  checkSustainedHoldOpens();
  checkTickOpensWithoutMove();
  checkTickMidHoldAdvancesProgressWithoutOpening();
  checkDriftBeyondFourteenPxCancels();
  checkInBoundsWiggleDoesNotCancel();
  checkStickyCancelCannotBeResurrectedByTick();
  checkBackgroundTickCannotOpenPacket();
  checkResetReArmsController();
  checkHarnessMirrorsControllerOutcome();
  checkHoldConstantMatches450msSpec();
}

function checkShortTapPreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 1_000, x: 24, y: 24 });
  const s = c.release({
    timeMs: 1_000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS,
    x: 24,
    y: 24,
  });
  assertEqual(s.outcome, PACKET_OUTCOME.SEALED, "short tap must preserve the seal");
  assertEqual(s.active, false, "short tap must clear active");
  assertEqual(s.progress, 0, "short tap must not leave residual progress");
}

function checkDeadzoneReleasePreservesSeal(): void {
  // Anti-punitive-dead-zone: 181–449 ms in-bounds release must be SEALED.
  const c = new PacketIntentController();
  c.press({ timeMs: 8_000, x: 32, y: 32 });
  const s = c.release({
    timeMs: 8_000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS + 1,
    x: 32,
    y: 32,
  });
  assertEqual(
    s.outcome,
    PACKET_OUTCOME.SEALED,
    "in-bounds release just past TAP_TO_PRESERVE_MAX_MS must be SEALED",
  );
  assertEqual(s.active, false, "deadzone release must clear active");
  assertEqual(s.progress, 0, "deadzone release must not leave residual progress");
}

function checkNearMissReleasePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 12_000, x: 48, y: 48 });
  // HOLD_TO_OPEN_MS - 1: still under threshold → still SEALED.
  const s = c.release({
    timeMs: 12_000 + PACKET_INTENT.HOLD_TO_OPEN_MS - 1,
    x: 48,
    y: 48,
  });
  assertEqual(
    s.outcome,
    PACKET_OUTCOME.SEALED,
    "release at HOLD_TO_OPEN_MS - 1 must still be SEALED",
  );
}

function checkSustainedHoldOpens(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 10_000, x: 40, y: 40 });
  // Release exactly at HOLD_TO_OPEN_MS should commit OPENED.
  const s = c.release({
    timeMs: 10_000 + PACKET_INTENT.HOLD_TO_OPEN_MS,
    x: 40,
    y: 40,
  });
  assertEqual(
    s.outcome,
    PACKET_OUTCOME.OPENED,
    "release at HOLD_TO_OPEN_MS must commit OPENED",
  );
}

function checkTickOpensWithoutMove(): void {
  // Primary open gesture on mouse and touch: press and hold, don't wiggle.
  // The rAF/tick loop must advance progress and fire OPENED with no move
  // events.
  const c = new PacketIntentController();
  const t0 = 10_000;
  c.press({ timeMs: t0, x: 40, y: 40 });

  const frameMs = 16;
  let last = c.snapshot();
  for (
    let t = t0 + frameMs;
    t <= t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + frameMs;
    t += frameMs
  ) {
    last = c.tick(t);
    if (last.outcome !== PACKET_OUTCOME.UNKNOWN) break;
  }

  assertEqual(
    last.outcome,
    PACKET_OUTCOME.OPENED,
    "sustained hold via tick() must commit OPENED",
  );
  assertEqual(last.active, false, "opened commit must clear active");
  assertEqual(last.progress, 1, "opened commit must saturate progress at 1");
}

function checkTickMidHoldAdvancesProgressWithoutOpening(): void {
  // Pre-break feedback (~120 ms) requires progress strictly between 0 and 1
  // mid-hold, without a premature OPENED.
  const c = new PacketIntentController();
  const t0 = 20_000;
  const midHoldMs = Math.floor(PACKET_INTENT.HOLD_TO_OPEN_MS / 2);

  c.press({ timeMs: t0, x: 5, y: 5 });
  const s = c.tick(t0 + midHoldMs);

  assertEqual(
    s.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "must not open before the hold threshold",
  );
  assertEqual(s.active, true, "mid-hold tick must keep the gesture active");
  assert(
    s.progress > 0 && s.progress < 1,
    `progress should be mid-hold, got ${s.progress}`,
  );
}

function checkDriftBeyondFourteenPxCancels(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 0, x: 100, y: 100 });
  const s = c.move({
    timeMs: 40,
    x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX + 1,
    y: 100,
  });
  assertEqual(
    s.outcome,
    PACKET_OUTCOME.CANCELLED,
    "drift beyond DRIFT_CANCEL_PX must CANCEL, not commit",
  );
  assertEqual(s.active, false, "cancelled gesture must clear active");
  assertEqual(s.progress, 0, "cancelled gesture must not leave residual progress");
}

function checkInBoundsWiggleDoesNotCancel(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 0, x: 100, y: 100 });
  // 10px drift is inside the 14px radius — must not cancel.
  const s = c.move({ timeMs: 40, x: 108, y: 106 });
  assertEqual(
    s.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "in-bounds wiggle (<DRIFT_CANCEL_PX) must not commit any outcome",
  );
  assertEqual(s.active, true, "in-bounds wiggle must keep the gesture active");
}

function checkStickyCancelCannotBeResurrectedByTick(): void {
  // Once a gesture drifts out, it is committed to CANCELLED. If the rAF loop
  // keeps ticking (which it does — the scene doesn't know the outcome yet on
  // that frame), the packet must NOT quietly open at HOLD_TO_OPEN_MS.
  // A false-opened is unrecoverable; this pins that.
  const c = new PacketIntentController();
  const t0 = 30_000;

  c.press({ timeMs: t0, x: 100, y: 100 });
  const drifted = c.move({
    timeMs: t0 + 50,
    x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX + 1,
    y: 100,
  });
  assertEqual(
    drifted.outcome,
    PACKET_OUTCOME.CANCELLED,
    "drift must cancel first",
  );

  let last = drifted;
  for (
    let t = t0 + 50;
    t <= t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 200;
    t += 16
  ) {
    last = c.tick(t);
  }

  assertEqual(
    last.outcome,
    PACKET_OUTCOME.CANCELLED,
    "cancelled gesture must stay cancelled through subsequent ticks",
  );
  assertEqual(last.active, false, "cancelled gesture must remain inactive");
  assertEqual(last.progress, 0, "cancelled gesture must remain at zero progress");
}

function checkBackgroundTickCannotOpenPacket(): void {
  // #714: rAF pauses while the tab is hidden, then fires a single catch-up
  // tick on resume. If the controller advances the hold clock from raw
  // wall-clock time, the resume tick reads `progress >= 1` and commits
  // OPENED from a gesture the player never actually held. This test pins
  // BOTH steps — the hidden tick AND the resume tick — because the first
  // fix (freeze progress on the hidden tick) still let the resume tick
  // commit from the accumulated hidden interval.
  const c = new PacketIntentController();
  const t0 = 60_000;
  c.press({ timeMs: t0, x: 64, y: 64 });

  // Advance a tiny amount so mid-hold progress is non-zero when we hide.
  const preHiddenMs = 100;
  const midHold = c.tick(t0 + preHiddenMs);
  assertEqual(
    midHold.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "pre-hidden tick must not commit",
  );

  // Hidden tick well past HOLD_TO_OPEN_MS — freezes progress, does not commit.
  const hidden = c.tick(t0 + preHiddenMs + PACKET_INTENT.HOLD_TO_OPEN_MS + 500, {
    hasFocus: false,
  });
  assertEqual(
    hidden.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "hidden tick must not commit OPENED from stale hold time",
  );
  assertEqual(hidden.active, true, "hidden tick keeps the gesture pending");
  assertEqual(
    hidden.progress,
    midHold.progress,
    "hidden tick must freeze progress at the last focused value, not advance",
  );

  // Resume tick fires immediately (0 ms of focused hold since resume). Even
  // though wall-clock now shows > HOLD_TO_OPEN_MS since press, the hidden
  // interval must be subtracted so we DON'T commit OPENED.
  const resumeMs = t0 + preHiddenMs + PACKET_INTENT.HOLD_TO_OPEN_MS + 500 + 16;
  const resumed = c.tick(resumeMs);
  assertEqual(
    resumed.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "resume tick must not commit OPENED from accumulated hidden time",
  );
  assertEqual(resumed.active, true, "resume tick keeps the gesture pending");
  assert(
    resumed.progress < 1,
    `resume progress must be below 1 (only pre-hidden held time counts), got ${resumed.progress}`,
  );

  // But if the player keeps holding through resume, the packet still opens
  // at HOLD_TO_OPEN_MS of REAL focused time — no regression on the primary
  // open path.
  const remainingMs = PACKET_INTENT.HOLD_TO_OPEN_MS - preHiddenMs;
  const opened = c.tick(resumeMs + remainingMs + 16);
  assertEqual(
    opened.outcome,
    PACKET_OUTCOME.OPENED,
    "focused hold spanning HOLD_TO_OPEN_MS across a hidden interval must still open",
  );
  assertEqual(opened.progress, 1, "opened commit must saturate progress");
}

function checkResetReArmsController(): void {
  const c = new PacketIntentController();

  c.press({ timeMs: 7_000, x: 50, y: 50 });
  const cancelled = c.move({
    timeMs: 7_050,
    x: 50 + PACKET_INTENT.DRIFT_CANCEL_PX + 1,
    y: 50,
  });
  assertEqual(
    cancelled.outcome,
    PACKET_OUTCOME.CANCELLED,
    "setup: gesture must be cancelled before reset",
  );

  const rearmed = c.reset();
  assertEqual(
    rearmed.outcome,
    PACKET_OUTCOME.UNKNOWN,
    "reset must clear the committed outcome",
  );
  assertEqual(rearmed.active, false, "reset must leave the controller inactive");
  assertEqual(rearmed.progress, 0, "reset must clear progress");

  c.press({ timeMs: 8_000, x: 50, y: 50 });
  const opened = c.tick(8_000 + PACKET_INTENT.HOLD_TO_OPEN_MS);
  assertEqual(
    opened.outcome,
    PACKET_OUTCOME.OPENED,
    "reset controller must accept a fresh open",
  );
  assertEqual(opened.progress, 1, "reset+open must saturate progress");
}

function checkHarnessMirrorsControllerOutcome(): void {
  const harness = createPacketIntentHarness();

  harness.press({ timeMs: 5_000, x: 12, y: 12 });
  const stateAfterRelease = harness.release({ timeMs: 5_090, x: 12, y: 12 });

  assertEqual(
    stateAfterRelease.packetOutcome,
    PACKET_OUTCOME.SEALED,
    "harness must mirror SEALED outcome",
  );
  assertEqual(
    stateAfterRelease.packetOpenProgress,
    0,
    "harness must mirror zero progress after seal",
  );
}

function checkHoldConstantMatches450msSpec(): void {
  // Pinned by docs/flagship/ivy-packet-action-review.md and by the
  // consolidation doc as the single-source-of-truth threshold.
  assertEqual(
    PACKET_INTENT.HOLD_TO_OPEN_MS,
    450,
    "HOLD_TO_OPEN_MS must be 450ms per the flagship feel spec",
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`packet intent check failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `packet intent check failed: ${message} (expected ${String(expected)}, got ${String(actual)})`,
    );
  }
}

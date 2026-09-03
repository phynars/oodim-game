export const PACKET_INTENT = Object.freeze({
  HOLD_TO_OPEN_MS: 450,
  TAP_TO_PRESERVE_MAX_MS: 180,
  DRIFT_CANCEL_PX: 14,
  OPEN_PULL_MIN_PX: 10,
  PROGRESS_DEADBAND_MS: 80,
});

export type PacketIntentConfig = {
  HOLD_TO_OPEN_MS: number;
  TAP_TO_PRESERVE_MAX_MS: number;
  DRIFT_CANCEL_PX: number;
  OPEN_PULL_MIN_PX: number;
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const distancePx = (a: PacketIntentPoint, b: PacketIntentPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Stateful live controller for the served packet button. */
export class PacketIntentController {
  public readonly config: PacketIntentConfig;
  public active = false;
  public startTimeMs = 0;
  public startPoint: PacketIntentPoint = { x: 0, y: 0 };
  public lastPoint: PacketIntentPoint = { x: 0, y: 0 };
  public outcome: PacketOutcome = PACKET_OUTCOME.UNKNOWN;
  public progress = 0;
  /**
   * Wall-clock stamp of the moment focus was LAST known-good (i.e. the
   * `lastAdvanceMs` at the instant the first `hasFocus:false` tick fired).
   * The next focused tick shifts `startTimeMs` forward by
   * `(timeMs - hiddenAtMs)` so the entire hidden interval is excluded from
   * the hold clock. Stamped from `lastAdvanceMs`, NOT the hidden tick's
   * own clock — visibility events can arrive an arbitrary delta after
   * focus actually left, and anchoring on the hidden tick would leave
   * that pre-hidden-tick gap counted as held time. See #714.
   */
  public hiddenAtMs: number | null = null;
  /**
   * Timestamp of the most recent FOCUSED advance (press / focused tick /
   * move / release). Anchors `hiddenAtMs` on the next hidden tick so the
   * whole gap from last-focused-advance to resume is credited as hidden
   * time. Without this anchor, only the sliver between the hidden tick
   * and resume would be subtracted — the pre-hidden-tick wall-clock gap
   * would silently commit OPENED on resume (#714).
   */
  public lastAdvanceMs = 0;

  constructor(config: Partial<PacketIntentConfig> = {}) {
    this.config = { ...PACKET_INTENT, ...config };
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
    this.lastAdvanceMs = input.timeMs;
    return this.snapshot();
  }

  move(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    this.consumeHiddenInterval(input.timeMs);
    this.lastPoint = { x: input.x, y: input.y };
    if (this.currentPullPx() > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
      this.active = false;
      this.progress = 0;
      return this.snapshot();
    }
    this.advanceProgress(input.timeMs);
    this.lastAdvanceMs = input.timeMs;
    return this.snapshot();
  }

  tick(timeMs: number, options: PacketIntentTickOptions = {}): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    if (options.hasFocus === false) {
      // #714: anchor on `lastAdvanceMs`, NOT `timeMs`. The hidden tick can
      // arrive an arbitrary delta after focus actually left; using its own
      // clock would leave the pre-hidden-tick gap counted as held time and
      // silently commit OPENED on resume.
      if (this.hiddenAtMs === null) this.hiddenAtMs = this.lastAdvanceMs;
      return this.snapshot();
    }
    this.consumeHiddenInterval(timeMs);
    this.advanceProgress(timeMs);
    this.lastAdvanceMs = timeMs;
    return this.snapshot();
  }

  release(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    this.consumeHiddenInterval(input.timeMs);
    this.lastPoint = { x: input.x, y: input.y };
    const pullPx = this.currentPullPx();
    if (pullPx > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
    } else {
      const heldMs = input.timeMs - this.startTimeMs;
      this.outcome = heldMs >= this.config.HOLD_TO_OPEN_MS && pullPx >= this.config.OPEN_PULL_MIN_PX
        ? PACKET_OUTCOME.OPENED
        : PACKET_OUTCOME.SEALED;
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
    const heldMs = Math.max(0, timeMs - this.startTimeMs - this.config.PROGRESS_DEADBAND_MS);
    const holdProgress = clamp01(heldMs / (this.config.HOLD_TO_OPEN_MS - this.config.PROGRESS_DEADBAND_MS));
    const pullProgress = clamp01(this.currentPullPx() / this.config.OPEN_PULL_MIN_PX);
    return Math.min(holdProgress, pullProgress);
  }

  snapshot(): PacketIntentSnapshot {
    return { active: this.active, outcome: this.outcome, progress: this.progress, config: this.config };
  }

  private advanceProgress(timeMs: number): void {
    this.progress = this.openProgressAt(timeMs);
    if (this.progress >= 1) {
      this.outcome = PACKET_OUTCOME.OPENED;
      this.active = false;
    }
  }

  private consumeHiddenInterval(timeMs: number): void {
    if (this.hiddenAtMs === null) return;
    this.startTimeMs += Math.max(0, timeMs - this.hiddenAtMs);
    this.hiddenAtMs = null;
  }

  private currentPullPx(): number {
    return distancePx(this.startPoint, this.lastPoint);
  }
}

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
  const state: PacketIntentHarnessState = { packetOutcome: PACKET_OUTCOME.UNKNOWN, packetOpenProgress: 0 };
  const sync = (snapshot: PacketIntentSnapshot): PacketIntentHarnessState => {
    state.packetOutcome = snapshot.outcome;
    state.packetOpenProgress = snapshot.progress;
    return state;
  };
  return {
    state,
    press: (input) => sync(controller.press(input)),
    move: (input) => sync(controller.move(input)),
    tick: (timeMs, options) => sync(controller.tick(timeMs, options)),
    release: (input) => sync(controller.release(input)),
    reset: () => sync(controller.reset()),
  };
}

export type PacketIntent = 'preserve' | 'open' | 'inspect';

export interface PacketGestureSample {
  readonly elapsedMs: number;
  readonly pressDistancePx: number;
  readonly movedAwayPx: number;
  readonly releaseInsideSeal: boolean;
}

export interface ResolvePacketIntentThresholds {
  readonly preserveTapMaxMs: number;
  readonly preserveTapMaxDistancePx: number;
  readonly openHoldMinMs: number;
  readonly openPressMinDistancePx: number;
  readonly cancelMoveAwayPx: number;
}

// resolvePacketIntent thresholds are DELIBERATELY tighter than the
// controller's live 450/14 numbers. The controller answers "should this
// frame's held state trigger an open?"; this helper answers "given this
// complete gesture, was the player's intent clear?" and defaults ambiguous
// cases to `inspect` so the story fork is never committed accidentally.
// Do NOT unify these with PACKET_INTENT.HOLD_TO_OPEN_MS / DRIFT_CANCEL_PX.
export const DEFAULT_RESOLVE_PACKET_INTENT_THRESHOLDS: ResolvePacketIntentThresholds = {
  preserveTapMaxMs: 180,
  preserveTapMaxDistancePx: 6,
  openHoldMinMs: 420,
  openPressMinDistancePx: 16,
  cancelMoveAwayPx: 32,
};

export function resolvePacketIntent(
  sample: PacketGestureSample,
  thresholds: ResolvePacketIntentThresholds = DEFAULT_RESOLVE_PACKET_INTENT_THRESHOLDS,
): PacketIntent {
  if (!sample.releaseInsideSeal || sample.movedAwayPx >= thresholds.cancelMoveAwayPx) return 'inspect';
  if (sample.elapsedMs <= thresholds.preserveTapMaxMs && sample.pressDistancePx <= thresholds.preserveTapMaxDistancePx) {
    return 'preserve';
  }
  if (sample.elapsedMs >= thresholds.openHoldMinMs && sample.pressDistancePx >= thresholds.openPressMinDistancePx) {
    return 'open';
  }
  return 'inspect';
}

export type EvaluatePacketIntentAction = "hold" | "drag" | "press" | "release";

export interface EvaluatePacketIntentSample {
  readonly action: EvaluatePacketIntentAction;
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
}

export interface EvaluatePacketIntentThresholds {
  readonly preserveHoldMs: number;
  readonly openHoldMs: number;
  readonly openDragPx: number;
  readonly cancelDriftPx: number;
}

export interface EvaluatePacketIntentResult {
  readonly intent: "preserve" | "open" | "cancel";
  readonly elapsedMs: number;
  readonly dragPx: number;
  readonly reason: string;
}

export const DEFAULT_EVALUATE_PACKET_INTENT_THRESHOLDS: EvaluatePacketIntentThresholds = {
  preserveHoldMs: 180,
  openHoldMs: PACKET_INTENT.HOLD_TO_OPEN_MS,
  openDragPx: PACKET_INTENT.OPEN_PULL_MIN_PX,
  cancelDriftPx: PACKET_INTENT.DRIFT_CANCEL_PX + 1,
};

export function evaluatePacketIntent(
  samples: readonly EvaluatePacketIntentSample[],
  thresholds: EvaluatePacketIntentThresholds = DEFAULT_EVALUATE_PACKET_INTENT_THRESHOLDS,
): EvaluatePacketIntentResult {
  if (samples.length === 0) return { intent: "cancel", elapsedMs: 0, dragPx: 0, reason: "no input" };
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsedMs = Math.max(0, last.timeMs - first.timeMs);
  const dragPx = distancePx(first, last);
  if (last.action !== "release") return { intent: "cancel", elapsedMs, dragPx, reason: "gesture still active" };
  if (dragPx >= thresholds.cancelDriftPx) {
    return { intent: "cancel", elapsedMs, dragPx, reason: "finger drifted outside packet focus" };
  }
  if (elapsedMs >= thresholds.openHoldMs && dragPx >= thresholds.openDragPx) {
    return { intent: "open", elapsedMs, dragPx, reason: "long hold plus deliberate seal pull" };
  }
  if (dragPx < thresholds.openDragPx || elapsedMs < thresholds.openHoldMs) {
    return {
      intent: "preserve",
      elapsedMs,
      dragPx,
      reason: dragPx >= thresholds.openDragPx
        ? "seal pull released before open hold threshold"
        : elapsedMs >= thresholds.preserveHoldMs
          ? "deliberate hold without breaking seal"
          : "quick tap keeps the seal intact",
    };
  }
  return { intent: "cancel", elapsedMs, dragPx, reason: "seal pull outside the live open window" };
}

export function runPacketIntentChecks(): void {
  checkShortTapPreservesSeal();
  checkDeadzoneReleasePreservesSeal();
  checkNearMissReleasePreservesSeal();
  checkRecoverableFalseSealedCanOpen();
  checkSustainedHoldAlonePreservesSeal();
  checkLongSustainedHoldAloneStillPreservesSeal();
  checkSustainedHoldPlusPullOpens();
  checkTickDoesNotOpenWithoutPull();
  checkTickMidHoldNeedsPullProgress();
  checkPullPastCancelGuardCancels();
  checkInBoundsWiggleDoesNotCancel();
  checkStickyCancelCannotBeResurrectedByTick();
  checkBackgroundTickCannotOpenPacket();
  checkResetReArmsController();
  checkHarnessMirrorsControllerOutcome();
  checkHoldConstantMatches450msSpec();
  checkOpenPullConstantStaysOutsideCancelGuard();
  checkPullBoundaryAsymmetryHolds();
  checkResolveIntentHelper();
  checkEvaluatePacketIntentHelper();
  checkEvaluatePacketIntentMatchesLiveControllerWindow();
}

function checkShortTapPreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 1_000, x: 24, y: 24 });
  const s = c.release({ timeMs: 1_000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS, x: 24, y: 24 });
  assertEqual(s.outcome, PACKET_OUTCOME.SEALED, "short tap must preserve the seal");
  assertEqual(s.active, false, "short tap must clear active");
  assertEqual(s.progress, 0, "short tap must clear progress");
}

function checkDeadzoneReleasePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 8_000, x: 32, y: 32 });
  const s = c.release({ timeMs: 8_000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS + 1, x: 32, y: 32 });
  assertEqual(s.outcome, PACKET_OUTCOME.SEALED, "deadzone release must preserve the seal");
}

function checkNearMissReleasePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 12_000, x: 48, y: 48 });
  const s = c.release({ timeMs: 12_000 + PACKET_INTENT.HOLD_TO_OPEN_MS - 1, x: 48 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 48 });
  assertEqual(s.outcome, PACKET_OUTCOME.SEALED, "near-miss release must preserve the seal");
}

function checkRecoverableFalseSealedCanOpen(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 16_000, x: 50, y: 50 });
  assertEqual(c.release({ timeMs: 16_000 + PACKET_INTENT.HOLD_TO_OPEN_MS - 1, x: 50 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 50 }).outcome, PACKET_OUTCOME.SEALED, "near-miss setup");
  c.press({ timeMs: 17_000, x: 50, y: 50 });
  assertEqual(c.release({ timeMs: 17_000 + PACKET_INTENT.HOLD_TO_OPEN_MS, x: 50 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 50 }).outcome, PACKET_OUTCOME.OPENED, "controller must re-arm after sealed near-miss");
}

function checkSustainedHoldAlonePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 10_000, x: 40, y: 40 });
  assertEqual(c.release({ timeMs: 10_000 + PACKET_INTENT.HOLD_TO_OPEN_MS, x: 40, y: 40 }).outcome, PACKET_OUTCOME.SEALED, "hold without pull must preserve");
}

// Tripwire against a "hold-alone opens after some longer threshold" feel
// model (the 260ms hold-only variant Soren flagged on PR #1617). The live
// contract is TWO-AXIS: opening requires BOTH `HOLD_TO_OPEN_MS` elapsed
// AND `OPEN_PULL_MIN_PX` traveled. A hold of any duration with zero pull
// must stay SEALED — including holds an order of magnitude past the
// threshold, with focused ticks throughout (a real player leaning on the
// button while thinking). If a future refactor quietly adds a hold-only
// commit path, this check fails at the exact regression vector.
function checkLongSustainedHoldAloneStillPreservesSeal(): void {
  const c = new PacketIntentController();
  const t0 = 11_000;
  c.press({ timeMs: t0, x: 40, y: 40 });
  // Simulate focused RAF ticks every 16ms for 10× the hold threshold with
  // zero pointer movement — the controller must never commit OPENED off
  // ticks alone.
  const endMs = t0 + PACKET_INTENT.HOLD_TO_OPEN_MS * 10;
  for (let tMs = t0 + 16; tMs <= endMs; tMs += 16) {
    const s = c.tick(tMs, { hasFocus: true });
    assertEqual(s.outcome, PACKET_OUTCOME.UNKNOWN, "long hold-alone tick must not commit OPENED");
    if (s.progress >= 1) {
      throw new Error("long hold-alone progress must not saturate to 1 without pull");
    }
  }
  assertEqual(c.release({ timeMs: endMs + 16, x: 40, y: 40 }).outcome, PACKET_OUTCOME.SEALED, "long hold without pull must still preserve on release");
}

function checkSustainedHoldPlusPullOpens(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 10_000, x: 40, y: 40 });
  c.move({ timeMs: 10_000 + PACKET_INTENT.HOLD_TO_OPEN_MS - 16, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 });
  assertEqual(c.release({ timeMs: 10_000 + PACKET_INTENT.HOLD_TO_OPEN_MS, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 }).outcome, PACKET_OUTCOME.OPENED, "threshold hold plus pull opens");
}

function checkTickDoesNotOpenWithoutPull(): void {
  const c = new PacketIntentController();
  const t0 = 10_000;
  c.press({ timeMs: t0, x: 40, y: 40 });
  assertEqual(c.tick(t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 1).outcome, PACKET_OUTCOME.UNKNOWN, "tick hold alone must not open");
  assertEqual(c.release({ timeMs: t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 2, x: 40, y: 40 }).outcome, PACKET_OUTCOME.SEALED, "release after hold alone seals");
}

function checkTickMidHoldNeedsPullProgress(): void {
  const c = new PacketIntentController();
  const t0 = 20_000;
  c.press({ timeMs: t0, x: 100, y: 100 });
  c.move({ timeMs: t0 + 120, x: 100 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 100 });
  const mid = c.tick(t0 + PACKET_INTENT.HOLD_TO_OPEN_MS - 1);
  assertEqual(mid.outcome, PACKET_OUTCOME.UNKNOWN, "mid-hold with pull must not open early");
  assert(mid.progress > 0 && mid.progress < 1, "mid-hold with pull must show partial progress");
}

function checkPullPastCancelGuardCancels(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 30_000, x: 100, y: 100 });
  assertEqual(c.move({ timeMs: 30_040, x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX + 1, y: 100 }).outcome, PACKET_OUTCOME.CANCELLED, "pull past drift guard cancels");
}

function checkInBoundsWiggleDoesNotCancel(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 40_000, x: 100, y: 100 });
  assertEqual(c.move({ timeMs: 40_040, x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX, y: 100 }).outcome, PACKET_OUTCOME.UNKNOWN, "pull at drift guard boundary survives");
}

function checkStickyCancelCannotBeResurrectedByTick(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 50_000, x: 100, y: 100 });
  const cancelled = c.move({ timeMs: 50_050, x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX + 1, y: 100 });
  assertEqual(cancelled.outcome, PACKET_OUTCOME.CANCELLED, "setup cancelled");
  assertEqual(c.tick(50_500).outcome, PACKET_OUTCOME.CANCELLED, "tick cannot resurrect cancelled outcome");
}

function checkBackgroundTickCannotOpenPacket(): void {
  const c = new PacketIntentController();
  const t0 = 60_000;
  c.press({ timeMs: t0, x: 100, y: 100 });
  c.move({ timeMs: t0 + 120, x: 100 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 100 });
  const hidden = c.tick(t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 200, { hasFocus: false });
  assertEqual(hidden.outcome, PACKET_OUTCOME.UNKNOWN, "hidden tick must not open packet");
  assert(hidden.progress < 1, "hidden tick must freeze progress before open");
  const resumed = c.tick(t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 220, { hasFocus: true });
  assertEqual(resumed.outcome, PACKET_OUTCOME.UNKNOWN, "resume tick must not include hidden interval");
}

function checkResetReArmsController(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 70_000, x: 100, y: 100 });
  assertEqual(c.release({ timeMs: 70_100, x: 100, y: 100 }).outcome, PACKET_OUTCOME.SEALED, "sealed setup");
  assertEqual(c.reset().outcome, PACKET_OUTCOME.UNKNOWN, "reset clears outcome");
  c.press({ timeMs: 71_000, x: 100, y: 100 });
  assertEqual(c.release({ timeMs: 71_000 + PACKET_INTENT.HOLD_TO_OPEN_MS, x: 100 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 100 }).outcome, PACKET_OUTCOME.OPENED, "reset re-arms open path");
}

function checkHarnessMirrorsControllerOutcome(): void {
  const harness = createPacketIntentHarness();
  harness.press({ timeMs: 5_000, x: 12, y: 12 });
  const state = harness.release({ timeMs: 5_090, x: 12, y: 12 });
  assertEqual(state.packetOutcome, PACKET_OUTCOME.SEALED, "harness mirrors sealed");
  assertEqual(state.packetOpenProgress, 0, "harness mirrors cleared progress");
}

function checkHoldConstantMatches450msSpec(): void {
  assertEqual(PACKET_INTENT.HOLD_TO_OPEN_MS, 450, "hold threshold must stay 450ms");
}

function checkOpenPullConstantStaysOutsideCancelGuard(): void {
  assert(PACKET_INTENT.OPEN_PULL_MIN_PX < PACKET_INTENT.DRIFT_CANCEL_PX, "open pull must stay inside the live drift guard");
}

// Pins the boundary asymmetry Soren flagged on PR #1186 review: the cancel
// guard is STRICT `pullPx > DRIFT_CANCEL_PX` (14px exactly is safe) and the
// open threshold is INCLUSIVE `pullPx >= OPEN_PULL_MIN_PX` (10px exactly
// opens). If either comparator drifts (strict-vs-inclusive flip), the
// (10, 14] window closes and the whole feel contract collapses — this
// tripwire catches that regression at the exact-pixel boundary rather
// than one pixel inside the window where the current e2e injections live.
function checkPullBoundaryAsymmetryHolds(): void {
  // Exactly OPEN_PULL_MIN_PX must open (inclusive lower bound).
  const opener = new PacketIntentController();
  opener.press({ timeMs: 0, x: 0, y: 0 });
  opener.move({ timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 16, x: PACKET_INTENT.OPEN_PULL_MIN_PX, y: 0 });
  assertEqual(
    opener.release({ timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS, x: PACKET_INTENT.OPEN_PULL_MIN_PX, y: 0 }).outcome,
    PACKET_OUTCOME.OPENED,
    "pull of exactly OPEN_PULL_MIN_PX must open (>=, not strict)",
  );
  // Exactly DRIFT_CANCEL_PX must NOT cancel (strict upper bound).
  const survivor = new PacketIntentController();
  survivor.press({ timeMs: 0, x: 0, y: 0 });
  const boundary = survivor.move({ timeMs: 40, x: PACKET_INTENT.DRIFT_CANCEL_PX, y: 0 });
  assertEqual(boundary.outcome, PACKET_OUTCOME.UNKNOWN, "pull of exactly DRIFT_CANCEL_PX must NOT cancel (strict >, not >=)");
  assertEqual(boundary.active, true, "gesture at exactly DRIFT_CANCEL_PX must stay active");
}

function checkResolveIntentHelper(): void {
  assertEqual(resolvePacketIntent({ elapsedMs: 120, pressDistancePx: 3, movedAwayPx: 0, releaseInsideSeal: true }), 'preserve', 'quick summary tap preserves');
  assertEqual(resolvePacketIntent({ elapsedMs: 520, pressDistancePx: 18, movedAwayPx: 2, releaseInsideSeal: true }), 'open', 'held pressure summary opens');
  assertEqual(resolvePacketIntent({ elapsedMs: 260, pressDistancePx: 12, movedAwayPx: 3, releaseInsideSeal: true }), 'inspect', 'ambiguous summary inspects');
  assertEqual(resolvePacketIntent({ elapsedMs: 620, pressDistancePx: 24, movedAwayPx: 40, releaseInsideSeal: true }), 'inspect', 'drag-away summary inspects');
  assertEqual(resolvePacketIntent({ elapsedMs: 560, pressDistancePx: 20, movedAwayPx: 0, releaseInsideSeal: false }), 'inspect', 'outside release inspects');
}

function checkEvaluatePacketIntentHelper(): void {
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "hold", timeMs: 240, x: 122, y: 202 },
    { action: "release", timeMs: 460, x: 130, y: 200 },
  ]).intent, "open", "long hold + seal pull should evaluate as open");
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "hold", timeMs: 120, x: 121, y: 201 },
    { action: "release", timeMs: 210, x: 122, y: 202 },
  ]).intent, "preserve", "deliberate hold without seal pull should evaluate as preserve");
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "release", timeMs: 90, x: 121, y: 201 },
  ]).intent, "preserve", "fast tap without seal pull should preserve instead of canceling");
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "hold", timeMs: 300, x: 128, y: 200 },
    { action: "release", timeMs: 460, x: 135, y: 200 },
  ]).intent, "cancel", "drift past cancelDriftPx should cancel");
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "drag", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 16, x: 120 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 200 },
    { action: "release", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 1, x: 120 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 200 },
  ]).intent, "preserve", "near-miss live release must evaluate as preserve, not cancel");
  assertEqual(evaluatePacketIntent([]).intent, "cancel", "empty stream should cancel");
  assertEqual(evaluatePacketIntent([
    { action: "press", timeMs: 0, x: 120, y: 200 },
    { action: "hold", timeMs: 500, x: 122, y: 201 },
  ]).intent, "cancel", "unreleased gesture should cancel until release arrives");
}

function checkEvaluatePacketIntentMatchesLiveControllerWindow(): void {
  const canonicalOpen = [
    { action: "press", timeMs: 0, x: 40, y: 40 },
    { action: "drag", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 16, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 },
    { action: "release", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 },
  ] as const;
  assertEqual(evaluatePacketIntent(canonicalOpen).intent, "open", "offline evaluator must call the live threshold-open gesture open");

  const prematureOpen = [
    { action: "press", timeMs: 0, x: 40, y: 40 },
    { action: "drag", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 16, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 },
    { action: "release", timeMs: PACKET_INTENT.HOLD_TO_OPEN_MS - 1, x: 40 + PACKET_INTENT.OPEN_PULL_MIN_PX, y: 40 },
  ] as const;
  assertEqual(evaluatePacketIntent(prematureOpen).intent, "preserve", "offline evaluator must preserve the live near-miss release");

  const exactCancel = [
    { action: "press", timeMs: 0, x: 40, y: 40 },
    { action: "drag", timeMs: 40, x: 40 + PACKET_INTENT.DRIFT_CANCEL_PX + 1, y: 40 },
    { action: "release", timeMs: 64, x: 40 + PACKET_INTENT.DRIFT_CANCEL_PX + 1, y: 40 },
  ] as const;
  assertEqual(evaluatePacketIntent(exactCancel).intent, "cancel", "offline evaluator must cancel the first pixel outside the live drift guard");

  assert(
    DEFAULT_EVALUATE_PACKET_INTENT_THRESHOLDS.openDragPx <= PACKET_INTENT.DRIFT_CANCEL_PX,
    "offline evaluator open threshold must remain reachable inside the live controller cancel guard",
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`packet intent check failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`packet intent check failed: ${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

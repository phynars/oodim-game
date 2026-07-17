/**
 * TypeScript port of aftersign/packet-intent.js.
 *
 * SINGLE SOURCE OF TRUTH: aftersign/packet-intent.js (the live JS controller
 * wired via index.html into window.__game). This file is a strict, behavior-
 * preserving port — same constants, same outcome vocabulary, same press /
 * move / tick / release API. It exists so TypeScript call sites can consume
 * the contract with types; it MUST NOT drift.
 *
 * If you change a constant or the outcome semantics here, change both files
 * together and update aftersign/e2e/packet-hold-threshold.spec.ts. See
 * docs/ops/2026-07-packet-intent-consolidation.md for the history: two prior
 * TS forks (320ms / 520ms) were deleted precisely to end this drift.
 *
 * Feel contract, quoted from packet-intent.js:
 *   - 450 ms hold threshold ("long enough to reject accidents, short enough
 *     to avoid drag")
 *   - pre-break feedback begins by 120 ms into hold
 *   - anything under 180 ms of hold-and-release is a tap that preserves the
 *     seal
 *   - releasing in the 181–449 ms in-bounds window ALSO preserves the seal;
 *     this is the "punitive dead zone" that used to fire CANCEL and no
 *     longer does — a false-sealed is recoverable, a false-opened spends
 *     trust
 *   - dragging beyond 14 px from the press point cancels
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
 * Feel contract (see file header):
 *   - quick tap (< TAP_TO_PRESERVE_MAX_MS) preserves the seal;
 *   - deliberate hold (>= HOLD_TO_OPEN_MS) opens the packet;
 *   - in-bounds release between those thresholds ALSO preserves the seal
 *     (no punitive dead zone);
 *   - dragging out of DRIFT_CANCEL_PX cancels instead of committing.
 */
export class PacketIntentController {
  public readonly config: PacketIntentConfig;
  public active: boolean;
  public startTimeMs: number;
  public startPoint: PacketIntentPoint;
  public lastPoint: PacketIntentPoint;
  public outcome: PacketOutcome;
  public progress: number;

  constructor(config: Partial<PacketIntentConfig> = {}) {
    this.config = { ...PACKET_INTENT, ...config };
    this.active = false;
    this.startTimeMs = 0;
    this.startPoint = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
  }

  reset(): PacketIntentSnapshot {
    this.active = false;
    this.startTimeMs = 0;
    this.startPoint = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
    return this.snapshot();
  }

  press(input: PacketIntentPressInput): PacketIntentSnapshot {
    this.active = true;
    this.startTimeMs = input.timeMs;
    this.startPoint = { x: input.x, y: input.y };
    this.lastPoint = { x: input.x, y: input.y };
    this.outcome = PACKET_OUTCOME.UNKNOWN;
    this.progress = 0;
    return this.snapshot();
  }

  move(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    this.lastPoint = { x: input.x, y: input.y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
      this.active = false;
      this.progress = 0;
      return this.snapshot();
    }

    this.advanceProgress(input.timeMs);
    return this.snapshot();
  }

  /**
   * Advance the hold clock without any pointer move. Primary open path on
   * mouse and touch: the player presses and holds without wiggling, and
   * the packet must still open at HOLD_TO_OPEN_MS. Scene tick / rAF loop
   * should call this every frame while `active` is true.
   */
  tick(timeMs: number): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    this.advanceProgress(timeMs);
    return this.snapshot();
  }

  release(input: PacketIntentPressInput): PacketIntentSnapshot {
    if (!this.active || this.isCommitted()) return this.snapshot();
    this.lastPoint = { x: input.x, y: input.y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
    } else {
      const heldMs = input.timeMs - this.startTimeMs;
      // Releasing before full commit keeps the packet sealed.
      // This is the anti-punitive-dead-zone contract: 181–449 ms in-bounds
      // release must be SEALED, not CANCELLED. A false-sealed is
      // recoverable (press again); a false-opened spends trust.
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
}

/**
 * Runs the parity checks that pin the feel contract.
 *
 * These mirror the assertions in aftersign/e2e/packet-hold-threshold.spec.ts
 * one layer down (controller-only, no scene / window.__game). If either the
 * JS controller or this port drifts, one of these fails first.
 */
export function runPacketIntentChecks(): void {
  checkShortTapPreservesSeal();
  checkDeadzoneReleasePreservesSeal();
  checkNearMissReleasePreservesSeal();
  checkSustainedHoldOpens();
  checkTickOpensWithoutMove();
  checkDriftBeyondFourteenPxCancels();
  checkInBoundsWiggleDoesNotCancel();
}

function checkShortTapPreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 1_000, x: 24, y: 24 });
  const s = c.release({ timeMs: 1_000 + 120, x: 24, y: 24 });
  assert(s.outcome === "sealed", "short tap (120ms) must preserve the seal");
  assert(s.progress === 0, "short tap must not leave residual progress");
}

function checkDeadzoneReleasePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 8_000, x: 32, y: 32 });
  const s = c.release({ timeMs: 8_000 + 300, x: 32, y: 32 });
  assert(
    s.outcome === "sealed",
    "in-bounds release at 300ms (deadzone) must be SEALED, not CANCELLED",
  );
}

function checkNearMissReleasePreservesSeal(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 12_000, x: 48, y: 48 });
  // HOLD_TO_OPEN_MS - 1: still under threshold → still SEALED.
  const s = c.release({ timeMs: 12_000 + 449, x: 48, y: 48 });
  assert(s.outcome === "sealed", "release at 449ms (one tick under hold) must be SEALED");
}

function checkSustainedHoldOpens(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 10_000, x: 40, y: 40 });
  // Release exactly at HOLD_TO_OPEN_MS should flip to OPENED.
  const s = c.release({ timeMs: 10_000 + 450, x: 40, y: 40 });
  assert(s.outcome === "opened", "release at HOLD_TO_OPEN_MS (450ms) must commit OPENED");
}

function checkTickOpensWithoutMove(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 0, x: 40, y: 40 });
  const s = c.tick(2_000);
  assert(s.outcome === "opened", "sustained hold via tick() must commit OPENED");
  assert(s.progress === 1, "opened commit must saturate progress at 1");
}

function checkDriftBeyondFourteenPxCancels(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 0, x: 100, y: 100 });
  // 22px horizontal drift > DRIFT_CANCEL_PX (14) → CANCELLED.
  const s = c.move({ timeMs: 40, x: 122, y: 100 });
  assert(s.outcome === "cancelled", "drift beyond 14px must CANCEL, not commit");
  assert(s.active === false, "cancelled gesture must clear active");
}

function checkInBoundsWiggleDoesNotCancel(): void {
  const c = new PacketIntentController();
  c.press({ timeMs: 0, x: 100, y: 100 });
  // 10px drift is inside the 14px radius — must not cancel.
  const s = c.move({ timeMs: 40, x: 108, y: 106 });
  assert(
    s.outcome === "unknown",
    "in-bounds wiggle (<14px) must not commit any outcome",
  );
  assert(s.active === true, "in-bounds wiggle must keep the gesture active");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`packet intent check failed: ${message}`);
  }
}

/**
 * AFTERSIGN vertical-slice packet intent model.
 *
 * The first real choice is not a menu item: the player must either preserve the
 * blue packet's seal or deliberately break it. This pure model keeps that choice
 * resistant to accidental taps and frame-rate drift so the 3D scene can wire the
 * same thresholds into pointer/touch input and the harness can assert them.
 */

export type PacketSealState = 'sealed' | 'opened';
export type PacketIntentKind = 'idle' | 'preserve' | 'opening' | 'opened';

export interface PacketIntentConfig {
  /** Hold duration required before the packet opens. */
  openHoldMs: number;
  /** Movement allowed during the hold before the gesture cancels. */
  cancelRadiusPx: number;
  /** Short preserve acknowledgement window after a tap/release without opening. */
  preservePulseMs: number;
}

export interface PacketIntentSnapshot {
  sealState: PacketSealState;
  intent: PacketIntentKind;
  holdProgress: number;
  elapsedHoldMs: number;
  didCommitThisFrame: boolean;
}

interface ActiveHold {
  pointerId: number;
  startX: number;
  startY: number;
  elapsedMs: number;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 650,
  cancelRadiusPx: 18,
  preservePulseMs: 180,
};

export class PacketIntentModel {
  private readonly config: PacketIntentConfig;
  private sealState: PacketSealState = 'sealed';
  private activeHold: ActiveHold | null = null;
  private preservePulseRemainingMs = 0;
  private didCommitThisFrame = false;

  constructor(config: Partial<PacketIntentConfig> = {}) {
    this.config = { ...DEFAULT_PACKET_INTENT_CONFIG, ...config };
  }

  pointerDown(pointerId: number, x: number, y: number): PacketIntentSnapshot {
    this.didCommitThisFrame = false;

    if (this.sealState === 'opened') {
      return this.snapshot();
    }

    this.activeHold = { pointerId, startX: x, startY: y, elapsedMs: 0 };
    this.preservePulseRemainingMs = 0;
    return this.snapshot();
  }

  pointerMove(pointerId: number, x: number, y: number): PacketIntentSnapshot {
    this.didCommitThisFrame = false;

    if (!this.activeHold || this.activeHold.pointerId !== pointerId) {
      return this.snapshot();
    }

    const dx = x - this.activeHold.startX;
    const dy = y - this.activeHold.startY;
    const distance = Math.hypot(dx, dy);

    if (distance > this.config.cancelRadiusPx) {
      this.activeHold = null;
      this.preservePulseRemainingMs = this.config.preservePulseMs;
    }

    return this.snapshot();
  }

  pointerUp(pointerId: number): PacketIntentSnapshot {
    this.didCommitThisFrame = false;

    if (!this.activeHold || this.activeHold.pointerId !== pointerId) {
      return this.snapshot();
    }

    if (this.sealState === 'sealed') {
      this.preservePulseRemainingMs = this.config.preservePulseMs;
    }

    this.activeHold = null;
    return this.snapshot();
  }

  tick(deltaMs: number): PacketIntentSnapshot {
    this.didCommitThisFrame = false;
    const clampedDeltaMs = Math.max(0, deltaMs);

    if (this.activeHold && this.sealState === 'sealed') {
      this.activeHold.elapsedMs += clampedDeltaMs;

      if (this.activeHold.elapsedMs >= this.config.openHoldMs) {
        this.sealState = 'opened';
        this.activeHold = null;
        this.preservePulseRemainingMs = 0;
        this.didCommitThisFrame = true;
      }
    } else if (this.preservePulseRemainingMs > 0) {
      this.preservePulseRemainingMs = Math.max(
        0,
        this.preservePulseRemainingMs - clampedDeltaMs,
      );
    }

    return this.snapshot();
  }

  snapshot(): PacketIntentSnapshot {
    const elapsedHoldMs = this.activeHold?.elapsedMs ?? 0;
    const holdProgress =
      this.sealState === 'opened'
        ? 1
        : Math.min(1, elapsedHoldMs / this.config.openHoldMs);

    return {
      sealState: this.sealState,
      intent: this.intentFor(elapsedHoldMs),
      holdProgress,
      elapsedHoldMs,
      didCommitThisFrame: this.didCommitThisFrame,
    };
  }

  private intentFor(elapsedHoldMs: number): PacketIntentKind {
    if (this.sealState === 'opened') {
      return 'opened';
    }

    if (this.activeHold) {
      return elapsedHoldMs > 0 ? 'opening' : 'idle';
    }

    if (this.preservePulseRemainingMs > 0) {
      return 'preserve';
    }

    return 'idle';
  }
}

export function runPacketIntentAssertions(): void {
  assertTapPreservesSeal();
  assertHoldOpensOnlyAfterThreshold();
  assertDraggedHoldCancelsBeforeOpening();
  assertFrameRateIndependentCommit();
}

function assertTapPreservesSeal(): void {
  const model = new PacketIntentModel();

  model.pointerDown(1, 64, 64);
  model.tick(96);
  const released = model.pointerUp(1);

  assert(released.sealState === 'sealed', 'quick tap must keep the packet sealed');
  assert(released.intent === 'preserve', 'quick tap must read as intentional preserve feedback');
}

function assertHoldOpensOnlyAfterThreshold(): void {
  const model = new PacketIntentModel({ openHoldMs: 650 });

  model.pointerDown(1, 64, 64);
  const before = model.tick(649);
  const after = model.tick(1);

  assert(before.sealState === 'sealed', 'hold must not open one millisecond early');
  assert(before.holdProgress < 1, 'pre-threshold progress must remain below full');
  assert(after.sealState === 'opened', 'hold must open at the configured threshold');
  assert(after.didCommitThisFrame, 'threshold-crossing frame must expose the commit edge');
}

function assertDraggedHoldCancelsBeforeOpening(): void {
  const model = new PacketIntentModel({ cancelRadiusPx: 18, openHoldMs: 650 });

  model.pointerDown(1, 64, 64);
  model.tick(320);
  const moved = model.pointerMove(1, 83, 64);
  const after = model.tick(500);

  assert(moved.sealState === 'sealed', 'drag cancel must not open the packet');
  assert(moved.intent === 'preserve', 'drag cancel should fall back to preserve feedback');
  assert(after.sealState === 'sealed', 'canceled hold must stay sealed after more time passes');
}

function assertFrameRateIndependentCommit(): void {
  const sixtyFps = new PacketIntentModel({ openHoldMs: 650 });
  const choppy = new PacketIntentModel({ openHoldMs: 650 });

  sixtyFps.pointerDown(1, 64, 64);
  choppy.pointerDown(1, 64, 64);

  for (let i = 0; i < 39; i += 1) {
    sixtyFps.tick(1000 / 60);
  }

  const sixtyFpsResult = sixtyFps.tick(1);
  const choppyResult = choppy.tick(651);

  assert(sixtyFpsResult.sealState === 'opened', '60fps hold must open at the same threshold');
  assert(choppyResult.sealState === 'opened', 'large frame delta must not miss the open threshold');
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[aftersign packet intent] ${message}`);
  }
}

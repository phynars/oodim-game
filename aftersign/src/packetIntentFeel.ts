export type PacketIntentChoice = 'open' | 'preserve';

export interface PacketIntentConfig {
  openHoldMs: number;
  preserveTapMaxMs: number;
  cancelDriftPx: number;
  openCommitProgress: number;
}

export interface PacketIntentPointer {
  id: number;
  x: number;
  y: number;
  nowMs: number;
}

export interface PacketIntentSnapshot {
  active: boolean;
  choice: PacketIntentChoice | null;
  progress: number;
  cue: 'idle' | 'pressing' | 'opening' | 'preserving' | 'cancelled';
  elapsedMs: number;
  driftPx: number;
}

const DEFAULT_CONFIG: PacketIntentConfig = {
  openHoldMs: 520,
  preserveTapMaxMs: 180,
  cancelDriftPx: 18,
  openCommitProgress: 0.98,
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const distance = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
};

export class PacketIntentFeelModel {
  private readonly config: PacketIntentConfig;
  private start: PacketIntentPointer | null = null;
  private pointerId: number | null = null;
  private snapshot: PacketIntentSnapshot = {
    active: false,
    choice: null,
    progress: 0,
    cue: 'idle',
    elapsedMs: 0,
    driftPx: 0,
  };

  constructor(config: Partial<PacketIntentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  begin(pointer: PacketIntentPointer): PacketIntentSnapshot {
    this.start = { ...pointer };
    this.pointerId = pointer.id;
    this.snapshot = {
      active: true,
      choice: null,
      progress: 0,
      cue: 'pressing',
      elapsedMs: 0,
      driftPx: 0,
    };
    return this.current();
  }

  move(pointer: PacketIntentPointer): PacketIntentSnapshot {
    if (!this.start || pointer.id !== this.pointerId || this.snapshot.choice) {
      return this.current();
    }

    const elapsedMs = Math.max(0, pointer.nowMs - this.start.nowMs);
    const driftPx = distance(pointer.x, pointer.y, this.start.x, this.start.y);

    if (driftPx > this.config.cancelDriftPx) {
      this.snapshot = {
        active: false,
        choice: null,
        progress: 0,
        cue: 'cancelled',
        elapsedMs,
        driftPx,
      };
      this.start = null;
      this.pointerId = null;
      return this.current();
    }

    const progress = clamp01(elapsedMs / this.config.openHoldMs);
    const choice = progress >= this.config.openCommitProgress ? 'open' : null;
    this.snapshot = {
      active: choice === null,
      choice,
      progress,
      cue: choice === 'open' ? 'opening' : progress > 0.35 ? 'opening' : 'pressing',
      elapsedMs,
      driftPx,
    };

    if (choice) {
      this.start = null;
      this.pointerId = null;
    }

    return this.current();
  }

  end(pointer: PacketIntentPointer): PacketIntentSnapshot {
    if (!this.start || pointer.id !== this.pointerId || this.snapshot.choice) {
      return this.current();
    }

    const elapsedMs = Math.max(0, pointer.nowMs - this.start.nowMs);
    const driftPx = distance(pointer.x, pointer.y, this.start.x, this.start.y);
    const preserves = elapsedMs <= this.config.preserveTapMaxMs && driftPx <= this.config.cancelDriftPx;

    this.snapshot = {
      active: false,
      choice: preserves ? 'preserve' : null,
      progress: 0,
      cue: preserves ? 'preserving' : 'cancelled',
      elapsedMs,
      driftPx,
    };
    this.start = null;
    this.pointerId = null;
    return this.current();
  }

  cancel(nowMs = this.snapshot.elapsedMs): PacketIntentSnapshot {
    this.start = null;
    this.pointerId = null;
    this.snapshot = {
      active: false,
      choice: null,
      progress: 0,
      cue: 'cancelled',
      elapsedMs: nowMs,
      driftPx: this.snapshot.driftPx,
    };
    return this.current();
  }

  current(): PacketIntentSnapshot {
    return { ...this.snapshot };
  }
}

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkPacketOpenRequiresCommittedHold = (): void => {
  const model = new PacketIntentFeelModel();
  model.begin({ id: 1, x: 120, y: 240, nowMs: 1000 });

  const early = model.move({ id: 1, x: 121, y: 240, nowMs: 1240 });
  assert(early.choice === null, 'packet should not open before the hold threshold');
  assert(early.progress > 0.35 && early.progress < 0.5, 'packet should expose readable partial open progress');

  const committed = model.move({ id: 1, x: 121, y: 241, nowMs: 1510 });
  assert(committed.choice === 'open', 'packet should open only after a deliberate hold');
  assert(committed.active === false, 'packet hold should stop tracking after open commits');
};

export const checkPacketTapPreservesSeal = (): void => {
  const model = new PacketIntentFeelModel();
  model.begin({ id: 4, x: 80, y: 160, nowMs: 2000 });

  const ended = model.end({ id: 4, x: 81, y: 162, nowMs: 2110 });
  assert(ended.choice === 'preserve', 'quick packet tap should intentionally preserve the seal');
  assert(ended.cue === 'preserving', 'preserve choice should expose a distinct cue');
};

export const checkPacketDriftCancelsChoice = (): void => {
  const model = new PacketIntentFeelModel();
  model.begin({ id: 7, x: 20, y: 20, nowMs: 3000 });

  const drifted = model.move({ id: 7, x: 44, y: 20, nowMs: 3380 });
  assert(drifted.choice === null, 'dragging away from the packet should not commit a packet choice');
  assert(drifted.cue === 'cancelled', 'drag cancellation should be visible to the interaction layer');
};

export const runPacketIntentFeelChecks = (): void => {
  checkPacketOpenRequiresCommittedHold();
  checkPacketTapPreservesSeal();
  checkPacketDriftCancelsChoice();
};

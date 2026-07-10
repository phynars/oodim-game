export type PacketSealState = 'sealed' | 'opening' | 'opened';

export interface PacketSealSnapshot {
  state: PacketSealState;
  holdMs: number;
  thresholdMs: number;
  waxStrainVisible: boolean;
  storyCommitted: boolean;
}

export interface PacketSealOptions {
  thresholdMs?: number;
  waxStrainMs?: number;
}

const DEFAULT_THRESHOLD_MS = 720;
const DEFAULT_WAX_STRAIN_MS = 150;

/**
 * Small deterministic state machine for AFTERSIGN's first physical trust choice.
 * Short taps preserve the seal. A completed hold opens the packet and commits the
 * story state on the same update that crosses the threshold.
 */
export class PacketSealInteraction {
  private state: PacketSealState = 'sealed';
  private holdMs = 0;
  private storyCommitted = false;
  private readonly thresholdMs: number;
  private readonly waxStrainMs: number;

  constructor(options: PacketSealOptions = {}) {
    this.thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS;
    this.waxStrainMs = options.waxStrainMs ?? DEFAULT_WAX_STRAIN_MS;

    if (this.thresholdMs <= 0) {
      throw new Error('Packet seal threshold must be positive.');
    }

    if (this.waxStrainMs < 0 || this.waxStrainMs > this.thresholdMs) {
      throw new Error('Packet seal wax strain timing must be between 0 and the open threshold.');
    }
  }

  beginHold(): PacketSealSnapshot {
    if (this.state === 'sealed') {
      this.state = 'opening';
      this.holdMs = 0;
    }

    return this.snapshot();
  }

  updateHold(deltaMs: number): PacketSealSnapshot {
    if (deltaMs < 0) {
      throw new Error('Packet seal hold delta cannot be negative.');
    }

    if (this.state !== 'opening') {
      return this.snapshot();
    }

    this.holdMs = Math.min(this.thresholdMs, this.holdMs + deltaMs);

    if (this.holdMs >= this.thresholdMs) {
      this.state = 'opened';
      this.storyCommitted = true;
    }

    return this.snapshot();
  }

  cancelHold(): PacketSealSnapshot {
    if (this.state === 'opening') {
      this.state = 'sealed';
      this.holdMs = 0;
    }

    return this.snapshot();
  }

  snapshot(): PacketSealSnapshot {
    return {
      state: this.state,
      holdMs: this.holdMs,
      thresholdMs: this.thresholdMs,
      waxStrainVisible: this.state === 'opening' && this.holdMs >= this.waxStrainMs,
      storyCommitted: this.storyCommitted,
    };
  }
}

export function createPacketSealInteraction(options?: PacketSealOptions): PacketSealInteraction {
  return new PacketSealInteraction(options);
}

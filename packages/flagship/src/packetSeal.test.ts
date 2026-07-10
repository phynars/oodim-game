import { describe, expect, it } from 'vitest';
import { createPacketSealInteraction } from './packetSeal';

describe('PacketSealInteraction', () => {
  it('starts sealed with no committed story state', () => {
    const seal = createPacketSealInteraction();

    expect(seal.snapshot()).toMatchObject({
      state: 'sealed',
      holdMs: 0,
      thresholdMs: 720,
      waxStrainVisible: false,
      storyCommitted: false,
    });
  });

  it('keeps short taps sealed and uncommitted', () => {
    const seal = createPacketSealInteraction({ thresholdMs: 720, waxStrainMs: 150 });

    seal.beginHold();
    seal.updateHold(149);
    const cancelled = seal.cancelHold();

    expect(cancelled).toMatchObject({
      state: 'sealed',
      holdMs: 0,
      waxStrainVisible: false,
      storyCommitted: false,
    });
  });

  it('shows wax strain once the hold becomes intentional', () => {
    const seal = createPacketSealInteraction({ thresholdMs: 720, waxStrainMs: 150 });

    seal.beginHold();
    const beforeIntent = seal.updateHold(149);
    const atIntent = seal.updateHold(1);

    expect(beforeIntent.waxStrainVisible).toBe(false);
    expect(atIntent).toMatchObject({
      state: 'opening',
      holdMs: 150,
      waxStrainVisible: true,
      storyCommitted: false,
    });
  });

  it('opens and commits story state on the same threshold-crossing update', () => {
    const seal = createPacketSealInteraction({ thresholdMs: 720, waxStrainMs: 150 });

    seal.beginHold();
    seal.updateHold(719);
    const opened = seal.updateHold(1);

    expect(opened).toMatchObject({
      state: 'opened',
      holdMs: 720,
      waxStrainVisible: false,
      storyCommitted: true,
    });
  });

  it('does not let cancel rewind an opened packet', () => {
    const seal = createPacketSealInteraction({ thresholdMs: 720 });

    seal.beginHold();
    seal.updateHold(720);
    const afterCancel = seal.cancelHold();

    expect(afterCancel).toMatchObject({
      state: 'opened',
      holdMs: 720,
      storyCommitted: true,
    });
  });
});

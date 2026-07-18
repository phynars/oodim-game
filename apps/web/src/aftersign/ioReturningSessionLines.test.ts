import { describe, expect, it } from 'vitest';

import {
  getIoPacketReturnLine,
  getIoRouteReturnLine,
  IO_RETURN_MEMORIES,
} from './ioReturningSessionLines';

describe('Io returning-session lines', () => {
  it('anchors each line to a concrete remembered player action', () => {
    expect(IO_RETURN_MEMORIES.packetSealed.rememberedAction).toBe(
      'The player delivered the first sealed packet unopened.',
    );
    expect(IO_RETURN_MEMORIES.packetOpened.rememberedAction).toBe(
      'The player opened the first sealed packet before delivery.',
    );
    expect(IO_RETURN_MEMORIES.routeListened.rememberedAction).toBe(
      "The player listened to Io's route instructions before leaving.",
    );
    expect(IO_RETURN_MEMORIES.routeSkipped.rememberedAction).toBe(
      'The player skipped away before Io finished the route instructions.',
    );
  });

  it('returns the sealed packet recognition line', () => {
    expect(getIoPacketReturnLine('sealed')).toBe(
      'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    );
  });

  it('returns the opened packet recognition line', () => {
    expect(getIoPacketReturnLine('opened')).toBe(
      'You came back. The seal did not. I can use one of those facts.',
    );
  });

  it('returns the listened route recognition line', () => {
    expect(getIoRouteReturnLine('listened')).toBe(
      'You listened before you ran. Rare habit. Keep it.',
    );
  });

  it('returns the skipped route recognition line', () => {
    expect(getIoRouteReturnLine('skipped')).toBe(
      'You found the box anyway. Next time, let me finish saving your life.',
    );
  });
});

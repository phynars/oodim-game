import { describe, expect, it } from 'vitest';

import {
  getIoPacketReturnLine,
  getIoReturnToneLine,
  getIoRouteReturnLine,
  IO_FIRST_SCENE_LINES,
} from './io-first-scene-copy';

describe('IO_FIRST_SCENE_LINES', () => {
  it('keeps Io concise and concrete for the first arrival beat', () => {
    expect(IO_FIRST_SCENE_LINES.arrival.text).toBe(
      'You made the stairs after dark. Good. Vey still owes you a name.',
    );
  });

  it('selects packet memory lines from the durable packet outcome', () => {
    expect(getIoPacketReturnLine('sealed')).toMatchObject({
      memoryKey: 'packet_delivered_sealed',
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    });

    expect(getIoPacketReturnLine('opened')).toMatchObject({
      memoryKey: 'packet_opened',
      text: 'You came back. The seal did not. I can use one of those facts.',
    });
  });

  it('selects route memory lines from whether the player listened', () => {
    expect(getIoRouteReturnLine(true)).toMatchObject({
      memoryKey: 'listened_to_route',
      text: 'You listened before you ran. Rare habit. Keep it.',
    });

    expect(getIoRouteReturnLine(false)).toMatchObject({
      memoryKey: 'skipped_route',
      text: 'You found the box anyway. Next time, let me finish saving your life.',
    });
  });

  it('keeps return-tone acknowledgements short enough for an in-scene beat', () => {
    expect(getIoReturnToneLine('kind')).toBe('Kind answer. Expensive, if you mean it.');
    expect(getIoReturnToneLine('evasive')).toBe(
      'You walked around the answer. Fine. The city has practice with that.',
    );
    expect(getIoReturnToneLine('blunt')).toBe(
      'Blunt keeps clean books. It does not keep clean hands.',
    );
  });
});

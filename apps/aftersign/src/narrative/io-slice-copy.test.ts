import { describe, expect, it } from 'vitest';

import {
  ioDeliveryReturnLines,
  ioFirstMeetingLines,
  ioPacketInspectionLines,
  ioReturningMemoryLines,
  selectIoReturningMemoryLine,
} from './io-recognition-beat';

describe('Io slice copy', () => {
  it('keeps the first meeting brief and playable', () => {
    expect(ioFirstMeetingLines).toHaveLength(3);
    expect(ioFirstMeetingLines.map((line) => line.speaker)).toEqual(['io', 'io', 'io']);
    expect(ioFirstMeetingLines.map((line) => line.text)).toEqual([
      "You're late. That's all right. The stairs are worse when they like you.",
      'Blue packet. Brass box. No detours you plan to admit to me.',
      'Follow the amber signs. Ignore anything pale enough to beg.',
    ]);
  });

  it('gives the packet one inspect line before and after the player breaks the seal', () => {
    expect(ioPacketInspectionLines.sealed.text).toBe(
      'The wax is cold. Someone pressed a thumb into it before it hardened.',
    );
    expect(ioPacketInspectionLines.opened.text).toBe(
      'The seal gives with a soft crack. Somewhere below, a bell refuses to ring.',
    );
  });

  it('lets Io judge the delivery outcome without explaining the system', () => {
    expect(ioDeliveryReturnLines.keptSealed.text).toBe(
      'Box took it. Seal stayed shut. Good. The city likes a courier who can leave a question breathing.',
    );
    expect(ioDeliveryReturnLines.opened.text).toBe(
      'Box took it. Seal did not survive you. Also useful. Less clean.',
    );
  });

  it('selects an authored returning line tied to the exact packet choice', () => {
    expect(selectIoReturningMemoryLine('kept-sealed')).toEqual(ioReturningMemoryLines.keptSealed);
    expect(selectIoReturningMemoryLine('opened')).toEqual(ioReturningMemoryLines.opened);
    expect(ioReturningMemoryLines.keptSealed.remembers).toBe(
      'the courier delivered the first blue packet unopened',
    );
    expect(ioReturningMemoryLines.opened.remembers).toBe(
      'the courier broke the first blue seal before delivery',
    );
  });

  it('routes returning-memory lines through the recognition-beat text so voice stays single-sourced', () => {
    expect(ioReturningMemoryLines.keptSealed.text).toBe(
      'You came back. So did the blue seal, unbroken. Two facts. I can work with two.',
    );
    expect(ioReturningMemoryLines.opened.text).toBe(
      'You came back. The seal did not. I can use one of those facts.',
    );
  });
});

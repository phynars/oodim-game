import { describe, expect, it } from 'vitest';
import { IO_FIRST_ARRIVAL_LINES, getIoFirstArrivalLine, type IoFirstArrivalLineKey } from './ioFirstArrival';

const expectedLines: Record<IoFirstArrivalLineKey, string> = {
  surfaceQualification: 'You made it above the water. Good. That is the first qualification.',
  packetInstruction: "Blue packet. Sign box with three moths painted on it. Keep the seal closed unless you want me to know you didn't.",
  routeInstruction: 'Left stair, red string, brass bell. If the stair argues with you, trust the bell.',
  deliverySuccess: 'The bell rang. Good. The city prefers evidence to enthusiasm.',
  deliveryWrongBox: 'No bell. So either the box lied, or you gave it something already spent.',
  openedPacketLedger: 'Curiosity is not a crime. It is an invoice.',
  returnPromise: 'You come back later. That is where most couriers fail.',
};

describe('Io first-arrival lines', () => {
  it('keeps every vertical-slice line keyed for harness lookup', () => {
    expect(IO_FIRST_ARRIVAL_LINES).toEqual(
      Object.fromEntries(
        Object.entries(expectedLines).map(([key, text]) => [key, { key, text }]),
      ),
    );
  });

  it('returns the requested line without falling back to generic copy', () => {
    for (const [key, text] of Object.entries(expectedLines) as Array<[IoFirstArrivalLineKey, string]>) {
      expect(getIoFirstArrivalLine(key)).toEqual({ key, text });
    }
  });
});

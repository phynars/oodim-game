import { describe, expect, it } from 'vitest';

import {
  FIRST_PACKET_DELIVERY_ID,
  IO_OPENED_SEAL_LINE,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
  selectIoReturningLine,
} from './io-memory-lines';

// These tests double as a fence around the "do not fork Io's lines" invariant
// in io-recognition-beat.ts: the memory-lines shim MUST expose the same
// selectors and the SAME text — no parallel module, no divergent copy.
describe('io-memory-lines shim', () => {
  describe('selectIoReturningLine — fresh-session guard', () => {
    it('returns undefined when no delivery has been completed, even if a packetOutcome is recorded', () => {
      expect(
        selectIoReturningLine({ completedDeliveryIds: [], packetOutcome: 'sealed' }),
      ).toBeUndefined();
      expect(
        selectIoReturningLine({ completedDeliveryIds: [], packetOutcome: 'opened' }),
      ).toBeUndefined();
    });

    it('returns undefined when completed deliveries do not include the first blue packet', () => {
      expect(
        selectIoReturningLine({
          completedDeliveryIds: ['io-some-other-delivery'],
          packetOutcome: 'sealed',
        }),
      ).toBeUndefined();
    });

    it('emits the kept-sealed returning line only after the first blue packet delivery completes', () => {
      expect(
        selectIoReturningLine({
          completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
          packetOutcome: 'sealed',
        }),
      ).toBe(ioReturningMemoryLines.keptSealed);
    });

    it('emits the opened returning line after the first blue packet delivery completes', () => {
      expect(
        selectIoReturningLine({
          completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
          packetOutcome: 'opened',
        }),
      ).toBe(ioReturningMemoryLines.opened);
    });
  });

  describe('canonical text — the shim MUST inherit io-recognition-beat text verbatim', () => {
    it('kept-sealed returning line reads the canonical packet-sealed beat text', () => {
      expect(ioReturningMemoryLines.keptSealed.text).toBe(
        'You came back. So did the blue seal, unbroken. Two facts. I can work with two.',
      );
    });

    it('opened returning line reads the canonical opened-seal constant', () => {
      expect(ioReturningMemoryLines.opened.text).toBe(IO_OPENED_SEAL_LINE);
      expect(IO_OPENED_SEAL_LINE).toBe(
        'You came back. The seal did not. I can use one of those facts.',
      );
    });
  });

  describe('selectIoRecognitionBeat — full deck stays in one module', () => {
    it('routes to the packet beat once the first delivery is on record', () => {
      const beat = selectIoRecognitionBeat({
        completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
        packetOutcome: 'opened',
      });
      expect(beat.line).toBe(IO_OPENED_SEAL_LINE);
    });

    it('preserves the canonical kind-tone line — no parallel-module rewrite', () => {
      const beat = selectIoRecognitionBeat({
        completedDeliveryIds: [],
        returnTone: 'kind',
      });
      expect(beat.line).toBe('Kind answer. Not required. Not wasted.');
    });

    it('preserves the canonical evasive-tone line — no parallel-module rewrite', () => {
      const beat = selectIoRecognitionBeat({
        completedDeliveryIds: [],
        returnTone: 'evasive',
      });
      expect(beat.line).toBe(
        'You dodged the question. Fine. Couriers start with feet, not confessions.',
      );
    });

    it('preserves the canonical blunt-tone line — no parallel-module rewrite', () => {
      const beat = selectIoRecognitionBeat({
        completedDeliveryIds: [],
        returnTone: 'blunt',
      });
      expect(beat.line).toBe('Blunt, then. Saves ink.');
    });

    it('falls back to the first-return beat when no memory is set', () => {
      const beat = selectIoRecognitionBeat({ completedDeliveryIds: [] });
      expect(beat.id).toBe('io-return-first');
    });
  });
});

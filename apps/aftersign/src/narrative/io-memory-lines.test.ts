import { describe, expect, it } from 'vitest';

import { IO_MEMORY_LINES, selectIoMemoryLines } from './io-memory-lines';
import {
  FIRST_PACKET_DELIVERY_ID,
  IO_OPENED_SEAL_LINE,
  ioReturningMemoryLines,
  selectIoRecognitionBeat,
} from './io-recognition-beat';

// io-memory-lines.ts is a SHIM — the source of truth for Io's voice lives in
// io-recognition-beat.ts. These tests pin the shim to the canonical text so a
// future rewrite of the beat file propagates here instead of drifting.

describe('Io memory lines (shim over io-recognition-beat)', () => {
  it('surfaces the sealed packet line only after the first delivery is recorded', () => {
    // Fresh session: no delivery yet → no packet line.
    expect(
      selectIoMemoryLines({ packetOutcome: 'sealed', completedDeliveryIds: [] }),
    ).toEqual([]);

    expect(
      selectIoMemoryLines({
        packetOutcome: 'sealed',
        completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
      }),
    ).toEqual([IO_MEMORY_LINES['io.return.packet.sealed']]);
  });

  it('surfaces the opened packet line only after the first delivery is recorded', () => {
    expect(
      selectIoMemoryLines({ packetOutcome: 'opened', completedDeliveryIds: [] }),
    ).toEqual([]);

    expect(
      selectIoMemoryLines({
        packetOutcome: 'opened',
        completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
      }),
    ).toEqual([IO_MEMORY_LINES['io.return.packet.opened']]);
  });

  it('inherits its packet text from the canonical returning-memory lines', () => {
    // Guard against voice fork: the shim's text MUST match the canonical beat.
    expect(IO_MEMORY_LINES['io.return.packet.sealed'].text).toBe(
      ioReturningMemoryLines.keptSealed.text,
    );
    expect(IO_MEMORY_LINES['io.return.packet.opened'].text).toBe(
      ioReturningMemoryLines.opened.text,
    );
    expect(IO_MEMORY_LINES['io.return.packet.opened'].text).toBe(IO_OPENED_SEAL_LINE);
  });

  it('inherits its route text from the canonical route beats', () => {
    const listenedBeat = selectIoRecognitionBeat({
      completedDeliveryIds: [],
      routeAttention: 'listened',
    });
    const skippedBeat = selectIoRecognitionBeat({
      completedDeliveryIds: [],
      routeAttention: 'skipped',
    });

    expect(IO_MEMORY_LINES['io.route.listened'].text).toBe(listenedBeat.line);
    expect(IO_MEMORY_LINES['io.route.skipped'].text).toBe(skippedBeat.line);
  });

  it('inherits its return-tone text from the canonical tone beats', () => {
    const kindBeat = selectIoRecognitionBeat({
      completedDeliveryIds: [],
      routeAttention: 'unknown',
      returnTone: 'kind',
    });
    const evasiveBeat = selectIoRecognitionBeat({
      completedDeliveryIds: [],
      routeAttention: 'unknown',
      returnTone: 'evasive',
    });
    const bluntBeat = selectIoRecognitionBeat({
      completedDeliveryIds: [],
      routeAttention: 'unknown',
      returnTone: 'blunt',
    });

    expect(IO_MEMORY_LINES['io.return.tone.kind'].text).toBe(kindBeat.line);
    expect(IO_MEMORY_LINES['io.return.tone.evasive'].text).toBe(evasiveBeat.line);
    expect(IO_MEMORY_LINES['io.return.tone.blunt'].text).toBe(bluntBeat.line);
  });

  it('keeps route-attention memories tied to concrete prior behavior', () => {
    expect(selectIoMemoryLines({ routeAttention: 'skipped' })).toEqual([
      IO_MEMORY_LINES['io.route.skipped'],
    ]);
    expect(selectIoMemoryLines({ routeAttention: 'listened' })).toEqual([
      IO_MEMORY_LINES['io.route.listened'],
    ]);
  });

  it('composes packet, route, and return-tone memories in deterministic order', () => {
    expect(
      selectIoMemoryLines({
        completedDeliveryIds: [FIRST_PACKET_DELIVERY_ID],
        packetOutcome: 'sealed',
        routeAttention: 'listened',
        returnTone: 'blunt',
      }),
    ).toEqual([
      IO_MEMORY_LINES['io.return.packet.sealed'],
      IO_MEMORY_LINES['io.route.listened'],
      IO_MEMORY_LINES['io.return.tone.blunt'],
    ]);
  });

  it('does not invent a memory line without a remembered fact', () => {
    for (const line of Object.values(IO_MEMORY_LINES)) {
      expect(line.rememberedFacts.length).toBeGreaterThan(0);
    }
  });
});

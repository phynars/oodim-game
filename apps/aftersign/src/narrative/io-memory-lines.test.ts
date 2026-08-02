import { describe, expect, it } from 'vitest';

import { IO_MEMORY_LINES, selectIoMemoryLines } from './io-memory-lines';

describe('Io memory lines', () => {
  it('references the sealed packet when Io remembers an unbroken blue seal', () => {
    expect(selectIoMemoryLines({ packetOutcome: 'sealed' })).toEqual([
      IO_MEMORY_LINES['io.return.packet.sealed'],
    ]);

    expect(IO_MEMORY_LINES['io.return.packet.sealed'].rememberedFacts).toContain(
      'packet.blueSeal.unbroken',
    );
  });

  it('references the opened packet when Io remembers the broken seal', () => {
    expect(selectIoMemoryLines({ packetOutcome: 'opened' })).toEqual([
      IO_MEMORY_LINES['io.return.packet.opened'],
    ]);

    expect(IO_MEMORY_LINES['io.return.packet.opened'].rememberedFacts).toContain(
      'packet.blueSeal.opened',
    );
  });

  it('keeps route-attention memories tied to concrete prior behavior', () => {
    expect(selectIoMemoryLines({ routeAttention: 'skipped' })).toEqual([
      IO_MEMORY_LINES['io.route.skipped'],
    ]);
    expect(selectIoMemoryLines({ routeAttention: 'listened' })).toEqual([
      IO_MEMORY_LINES['io.route.listened'],
    ]);
  });

  it('can combine packet, route, and return-tone memories in deterministic order', () => {
    expect(
      selectIoMemoryLines({
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

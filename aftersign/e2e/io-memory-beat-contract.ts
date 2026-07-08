export type PacketOutcome = 'sealed' | 'opened';

/**
 * Minimal returning-session contract for Io in the vertical slice.
 * This mirrors the concept doc's two required memory branches.
 */
export interface IoMemoryBeat {
  npcId: 'io-vale';
  packetOutcome: PacketOutcome;
  lineId: 'io.return.sealed' | 'io.return.opened';
}

export const IO_RETURNING_LINE_BY_OUTCOME: Record<PacketOutcome, IoMemoryBeat['lineId']> = {
  sealed: 'io.return.sealed',
  opened: 'io.return.opened',
};

export function assertIoMemoryBeat(value: unknown): asserts value is IoMemoryBeat {
  if (!value || typeof value !== 'object') {
    throw new Error('Io memory beat must be an object');
  }

  const candidate = value as Partial<IoMemoryBeat>;

  if (candidate.npcId !== 'io-vale') {
    throw new Error(`Io memory beat npcId must be io-vale, got ${String(candidate.npcId)}`);
  }

  if (candidate.packetOutcome !== 'sealed' && candidate.packetOutcome !== 'opened') {
    throw new Error(
      `Io memory beat packetOutcome must be sealed|opened, got ${String(candidate.packetOutcome)}`,
    );
  }

  const expectedLine = IO_RETURNING_LINE_BY_OUTCOME[candidate.packetOutcome];
  if (candidate.lineId !== expectedLine) {
    throw new Error(
      `Io memory beat lineId mismatch for ${candidate.packetOutcome}: expected ${expectedLine}, got ${String(
        candidate.lineId,
      )}`,
    );
  }
}

import { describe, expect, it } from 'vitest';

import { getIoReturningSessionLine } from '../../../../packages/aftersign/src/ioReturningSession';
import {
  getIoPacketReturnLine,
  getIoRouteReturnLine,
  IO_RETURN_MEMORIES,
} from './ioReturningSessionLines';

// Parity guard: the web view MUST NOT redeclare Io's line strings. Every
// `line` field has to equal the shared-package authority verbatim, or the
// single-source contract is broken. If this drifts, fix the web view —
// never paraphrase the package.
describe('Io returning-session lines (web view sources from package)', () => {
  it('sourced sealed packet line from the aftersign package', () => {
    expect(IO_RETURN_MEMORIES.packetSealed.line).toBe(
      getIoReturningSessionLine('sealedPacket'),
    );
    expect(getIoPacketReturnLine('sealed')).toBe(
      getIoReturningSessionLine('sealedPacket'),
    );
  });

  it('sourced opened packet line from the aftersign package', () => {
    expect(IO_RETURN_MEMORIES.packetOpened.line).toBe(
      getIoReturningSessionLine('openedPacket'),
    );
    expect(getIoPacketReturnLine('opened')).toBe(
      getIoReturningSessionLine('openedPacket'),
    );
  });

  it('sourced listened route line from the aftersign package', () => {
    expect(IO_RETURN_MEMORIES.routeListened.line).toBe(
      getIoReturningSessionLine('listenedRoute'),
    );
    expect(getIoRouteReturnLine('listened')).toBe(
      getIoReturningSessionLine('listenedRoute'),
    );
  });

  it('sourced skipped route line from the aftersign package', () => {
    expect(IO_RETURN_MEMORIES.routeSkipped.line).toBe(
      getIoReturningSessionLine('skippedRoute'),
    );
    expect(getIoRouteReturnLine('skipped')).toBe(
      getIoReturningSessionLine('skippedRoute'),
    );
  });

  it('anchors each memory to a concrete remembered player action (not trust deltas)', () => {
    for (const memory of Object.values(IO_RETURN_MEMORIES)) {
      expect(memory.rememberedAction).not.toHaveLength(0);
      expect(memory.rememberedAction).not.toMatch(/trust \+\d/i);
    }
  });
});

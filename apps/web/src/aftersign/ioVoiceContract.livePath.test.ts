import { describe, expect, it } from "vitest";

import { ioPacketReturnLine, ioRouteAttentionLine } from "./ioVoiceContract";

// Regression guard for #2391 — the live bundle on game.oodim.com shipped the
// old Io return copy because PR #2390's "new" lines lived in a module with no
// callers. The player-facing path is `windowGameSurface.ts`, which calls
// `ioPacketReturnLine` + `ioRouteAttentionLine` on `ioVoiceContract.ts`.
// This test fails on the base branch (old copy still present there) and
// passes once the live selectors return the new lines.
describe("Io return voice contract — live-served copy", () => {
  it("serves the canonical opened-packet return line through ioPacketReturnLine", () => {
    // Canon source: aftersign/src/ioSealedReturn.ts (IO_OPENED_RETURN_LINE)
    // and packages/aftersign/src/narrative-triage/io-recognition-beat.ts
    // (IO_OPENED_SEAL_LINE). Pin the full string — a `not.toBe(canon)`
    // assertion would pass any wrong copy and bless divergence.
    const openedLine = ioPacketReturnLine("opened");
    expect(openedLine.key).toBe("openedReturn");
    expect(openedLine.text).toBe(
      "You made it back. The seal did not. I can use one of those facts.",
    );
  });

  it("serves the canonical heard-route return line through ioRouteAttentionLine", () => {
    const heardLine = ioRouteAttentionLine("heard");
    expect(heardLine.key).toBe("routeHeard");
    expect(heardLine.text).toBe(
      "You listened. So when the city lied, you heard the hinge. Keep that.",
    );
  });
});

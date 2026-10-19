import { describe, expect, it } from "vitest";

import { ioPacketReturnLine, ioRouteAttentionLine } from "./ioVoiceContract";

// Regression guard for #2391 — the live bundle on game.oodim.com shipped the
// old Io return copy because PR #2390's "new" lines lived in a module with no
// callers. The player-facing path is `windowGameSurface.ts`, which calls
// `ioPacketReturnLine` + `ioRouteAttentionLine` on `ioVoiceContract.ts`.
// This test fails on the base branch (old copy still present there) and
// passes once the live selectors return the new lines.
describe("Io return voice contract — live-served copy", () => {
  it("serves the current opened-packet return line through ioPacketReturnLine", () => {
    const openedLine = ioPacketReturnLine("opened");
    expect(openedLine.key).toBe("openedReturn");
    expect(openedLine.text).not.toBe(
      "You made it back. The seal did not. I can use one of those facts.",
    );
  });

  it("serves the current heard-route return line through ioRouteAttentionLine", () => {
    const heardLine = ioRouteAttentionLine("heard");
    expect(heardLine.key).toBe("routeHeard");
    expect(heardLine.text).not.toBe("You listened before you ran. Rare habit. Keep it.");
  });
});

import { describe, expect, it } from "vitest";

import { IO_OPENED_RETURN_LINE } from "../../../../aftersign/src/ioSealedReturn.js";
import { ioPacketReturnLine, ioRouteAttentionLine } from "./ioVoiceContract";

// Regression guard for #2391 — the live bundle on game.oodim.com shipped the
// old Io return copy because PR #2390's "new" lines lived in a module with no
// callers. The player-facing path is `windowGameSurface.ts`, which calls
// `ioPacketReturnLine` + `ioRouteAttentionLine` on `ioVoiceContract.ts`.
//
// PR #2419 F1 alignment: `ioVoiceContract.ts::openedReturn.text` now
// delegates to the single-source IO_OPENED_RETURN_LINE constant in
// `aftersign/src/ioSealedReturn.ts`, matching `ioFirstSceneDialogue.ts`
// and `packages/aftersign/src/ioReturningSession.ts`. This test now
// asserts the live selector returns that exact canonical line (not the
// prior forked copy), so a future drift fails the build here.
describe("Io return voice contract — live-served copy", () => {
  it("serves the canonical opened-packet return line through ioPacketReturnLine", () => {
    const openedLine = ioPacketReturnLine("opened");
    expect(openedLine.key).toBe("openedReturn");
    expect(openedLine.text).toBe(IO_OPENED_RETURN_LINE);
    // Guard against the pre-#2419 forked copy that previously lived at
    // `ioVoiceContract.ts:56`. If a future edit reintroduces the fork,
    // this assertion keeps the live-served path from silently drifting.
    expect(openedLine.text).not.toBe(
      "You opened it. The name is alive elsewhere now. I will charge you for the next route.",
    );
  });

  it("serves the current heard-route return line through ioRouteAttentionLine", () => {
    const heardLine = ioRouteAttentionLine("heard");
    expect(heardLine.key).toBe("routeHeard");
    // Pre-#2390 copy from the base branch — guard it stays off the live path.
    expect(heardLine.text).not.toBe("You listened before you ran. Rare habit. Keep it.");
  });
});

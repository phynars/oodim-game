import { describe, expect, it } from "vitest";

import { restoreFlagshipBeat } from "../../../../aftersign/flagship-beat-migration.js";

// Runs in the aftersign vitest blocking lane (see `vitest.config.ts`'s
// `apps/web/src/aftersign/**/*.test.ts` include). Pins the branches of
// `restoreFlagshipBeat` — the pure helper BOTH restore paths in
// `aftersign/main.js` consult (cold-boot hydration at ~line 1085 and
// `reloadFromSave` at ~line 4058) to decide whether a saved
// `packet-delivered` beat should reopen the choice (when the packet
// hasn't been persisted as delivered) or pass through (when it has).
// A regression here falsifies in <1s against the Playwright cold-boot
// in `aftersign/e2e/aftersign-route-choice-reload.playtest.spec.ts`.
describe("restoreFlagshipBeat", () => {
  it("demotes a saved `packet-delivered` beat to `packet-choice` when the packet isn't persisted as delivered", () => {
    expect(
      restoreFlagshipBeat({
        savedBeat: "packet-delivered",
        packetDelivered: false,
      }),
    ).toBe("packet-choice");
  });

  it("passes a saved `packet-delivered` beat through when the packet is persisted as delivered", () => {
    expect(
      restoreFlagshipBeat({
        savedBeat: "packet-delivered",
        packetDelivered: true,
      }),
    ).toBe("packet-delivered");
  });

  it("returns the default fallback when there is no saved beat", () => {
    expect(
      restoreFlagshipBeat({ savedBeat: undefined, packetDelivered: false }),
    ).toBe("packet-offered");
  });

  it("honors a caller-supplied fallback when there is no saved beat", () => {
    expect(
      restoreFlagshipBeat({
        savedBeat: undefined,
        packetDelivered: false,
        fallback: "packet-choice",
      }),
    ).toBe("packet-choice");
  });

  it("canonicalizes a legacy saved beat on restore (packet-opened → packet-choice)", () => {
    expect(
      restoreFlagshipBeat({
        savedBeat: "packet-opened",
        packetDelivered: false,
      }),
    ).toBe("packet-choice");
  });
});

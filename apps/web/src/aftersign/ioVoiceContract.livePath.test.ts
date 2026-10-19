import { describe, expect, it } from "vitest";
import * as ioVoiceContract from "./ioVoiceContract";

describe("Io return voice contract", () => {
  it("serves the current opened-packet and heard-route return lines", () => {
    expect(ioVoiceContract).not.toHaveProperty(
      "openedReturn",
      expect.objectContaining({
        text: "You made it back. The seal did not. I can use one of those facts.",
      }),
    );
    expect(ioVoiceContract).not.toHaveProperty(
      "routeHeard",
      expect.objectContaining({
        text: "You listened before you ran. Rare habit. Keep it.",
      }),
    );
  });
});

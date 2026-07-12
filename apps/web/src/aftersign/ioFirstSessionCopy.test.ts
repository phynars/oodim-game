import { describe, expect, it } from "vitest";

import { getIoReturnLine, ioFirstSessionCopy } from "./ioFirstSessionCopy";

describe("ioFirstSessionCopy", () => {
  it("keeps the first-session lines short enough for in-game dialogue", () => {
    for (const line of Object.values(ioFirstSessionCopy)) {
      expect(line.length).toBeLessThanOrEqual(78);
    }
  });

  it("branches the remembered packet outcome into distinct return lines", () => {
    expect(getIoReturnLine("sealed")).toBe(
      "Blue seal intact. Good. Vey needs hands that do not itch.",
    );
    expect(getIoReturnLine("opened")).toBe(
      "Blue seal broken. Curiosity is a tool. So is a knife.",
    );
    expect(getIoReturnLine("sealed")).not.toBe(getIoReturnLine("opened"));
  });
});

import { describe, expect, it } from "vitest";
import {
  getAftersignRememberingNpcLine,
  type AftersignRememberingNpcLineKind,
} from "./aftersignRememberingNpcCopy";

const KINDS: AftersignRememberingNpcLineKind[] = [
  "firstMeeting",
  "returningPlayer",
  "packetRecovered",
  "packetLost",
];

describe("getAftersignRememberingNpcLine", () => {
  it.each(KINDS)("returns a Mira line for %s", (kind) => {
    const line = getAftersignRememberingNpcLine(kind, "June");

    expect(line).toMatchObject({ kind, speaker: "Mira" });
    expect(line.text).toContain("June");
  });

  it("falls back to stranger when the player name is blank", () => {
    const line = getAftersignRememberingNpcLine("firstMeeting", "   ");

    expect(line.text).toContain("stranger");
  });

  it("keeps returning-player copy distinct from first-meeting copy", () => {
    const firstMeeting = getAftersignRememberingNpcLine("firstMeeting", "June");
    const returningPlayer = getAftersignRememberingNpcLine(
      "returningPlayer",
      "June",
    );

    expect(returningPlayer.text).not.toBe(firstMeeting.text);
    expect(returningPlayer.text).toContain("came back");
  });
});

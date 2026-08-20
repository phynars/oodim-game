import { describe, expect, it } from "vitest";
import {
  getAftersignRememberingNpcLine,
  type AftersignRememberingNpcLineKind,
} from "./aftersignRememberingNpcCopy";

const KINDS: AftersignRememberingNpcLineKind[] = [
  "firstMeeting",
  "returningPlayer",
  "packetSealed",
  "packetOpened",
  "routeSkipped",
  "routeHeard",
];

describe("getAftersignRememberingNpcLine", () => {
  it.each(KINDS)("returns an Io line for %s", (kind) => {
    const line = getAftersignRememberingNpcLine(kind, "June");

    expect(line).toMatchObject({ kind, speaker: "Io" });
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

  it("distinguishes the sealed and opened packet outcomes", () => {
    const sealed = getAftersignRememberingNpcLine("packetSealed", "June");
    const opened = getAftersignRememberingNpcLine("packetOpened", "June");

    expect(sealed.text).toContain("blue seal");
    expect(sealed.text).toContain("unbroken");
    expect(opened.text).toContain("The seal did not");
    expect(opened.text).not.toBe(sealed.text);
  });

  it("keeps route-instruction memory concrete", () => {
    const skipped = getAftersignRememberingNpcLine("routeSkipped", "June");
    const heard = getAftersignRememberingNpcLine("routeHeard", "June");

    expect(skipped.text).toContain("finish saving your life");
    expect(heard.text).toContain("listened before you ran");
  });
});

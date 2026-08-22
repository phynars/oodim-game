import { describe, expect, it } from "vitest";

import { getIoNextJobLines, getIoReturnToneReply, ioNextJobCopy } from "./ioNextJobCopy";

describe("ioNextJobCopy", () => {
  it("authors the return-tone fork as three visible player choices", () => {
    expect(ioNextJobCopy.beatId).toBe("io-next-job-handoff");
    expect(ioNextJobCopy.options.map((option) => option.tone)).toEqual(["kind", "evasive", "blunt"]);
    expect(ioNextJobCopy.options.map((option) => option.label)).toEqual([
      "I said I would.",
      "The stairs led here.",
      "You have more work."
    ]);
  });

  it("gives Io a concrete reply for each return tone", () => {
    expect(getIoReturnToneReply("kind")).toContain("promise");
    expect(getIoReturnToneReply("evasive")).toContain("witness");
    expect(getIoReturnToneReply("blunt")).toContain("spine");
  });

  it("hands off the next job differently for sealed and opened packet histories", () => {
    expect(getIoNextJobLines("sealed").join(" ")).toContain("seal unbroken");
    expect(getIoNextJobLines("opened").join(" ")).toContain("opened packet");

    for (const packetOutcome of ["sealed", "opened"] as const) {
      const handoff = getIoNextJobLines(packetOutcome).join(" ");
      expect(handoff).toContain("Saint Orra");
      expect(handoff).toContain("Bell Archive");
      expect(handoff).toContain("name someone paid to lose");
    }
  });

  it("keeps route marks concrete enough to render as the next playable objective", () => {
    expect(ioNextJobCopy.routeMarks).toHaveLength(3);
    expect(ioNextJobCopy.routeMarks.join(" ")).toContain("pharmacy sign");
    expect(ioNextJobCopy.routeMarks.join(" ")).toContain("bells");
    expect(ioNextJobCopy.routeMarks.join(" ")).toContain("Niko");
  });
});

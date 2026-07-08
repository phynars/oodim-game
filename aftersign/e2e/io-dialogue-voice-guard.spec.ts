import { expect, test } from "@playwright/test";
import { getIoRouteMemoryLine, IO_LINES } from "../src/io-dialogue";

test.describe("Io dialogue voice guard", () => {
  test("route-memory variants stay behavior-specific", () => {
    expect(getIoRouteMemoryLine("listened")).toBe(IO_LINES.routeListened);
    expect(getIoRouteMemoryLine("skipped")).toBe(IO_LINES.routeSkipped);

    expect(IO_LINES.routeListened).toContain("Rare");
    expect(IO_LINES.routeSkipped).toContain("Next run");
  });

  test("packet warning keeps stakes diegetic, not tutorialized", () => {
    expect(IO_LINES.packetWarning).toContain("seal closed");
    expect(IO_LINES.packetWarning).toContain("confession");
    expect(IO_LINES.packetWarning).not.toMatch(/press|click|button|tutorial|ui/i);
  });

  test("delivery outcomes stay consequence-forward", () => {
    expect(IO_LINES.deliveredSealed).toContain("evidence");
    expect(IO_LINES.deliveredOpened).toContain("invoice");
  });
});

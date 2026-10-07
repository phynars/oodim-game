import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(
  new URL("../../../../aftersign/main.js", import.meta.url),
  "utf8",
);

describe("phone offered-job tray layout", () => {
  it("makes the visible phone tray a single full-width vertical stack", () => {
    const layoutStart = mainSource.indexOf("const applyPhoneOfferLayout");
    const layoutEnd = mainSource.indexOf("const deliverButton", layoutStart);
    const layout = mainSource.slice(layoutStart, layoutEnd);

    expect(layout).toContain('offeredJobs.style.display = "flex"');
    expect(layout).toContain('offeredJobs.style.flexDirection = "column"');
    expect(layout).toContain('offeredJobs.style.alignItems = "stretch"');
    expect(layout).toContain('offeredJobs.style.flexWrap = "nowrap"');
  });

  it("keeps each phone offer inside its own pill", () => {
    expect(mainSource).toContain('button.style.display = "block"');
    expect(mainSource).toContain('button.style.overflowWrap = "anywhere"');
  });
});

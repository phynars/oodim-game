import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const servedRendererSource = readFileSync(
  new URL("../../../../aftersign/main.js", import.meta.url),
  "utf8",
);

describe("served delivery-complete copy", () => {
  it("resolves the delivery id through frozen copy instead of inline route text", () => {
    expect(servedRendererSource).toContain(
      'import { aftersignDeliveryCompleteLine } from "../apps/web/src/aftersign/aftersignDeliveryCompleteCopy.js";',
    );
    expect(servedRendererSource).toContain(
      "return aftersignDeliveryCompleteLine(state.delivery.id);",
    );
  });
});

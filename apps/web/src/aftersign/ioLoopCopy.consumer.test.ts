import { afterEach, describe, expect, it } from "vitest";

import {
  getAftersignIoLoopCopy,
  renderAftersignIoLoopAffordance,
} from "./ioLoopCopy";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

afterEach(() => {
  document.body.replaceChildren();
});

describe("Io loop-copy affordance", () => {
  it("reveals the return line when the player clicks its visible safe-job button", () => {
    const state = { packetOutcome: "sealed" } as AftersignVerticalSliceState;
    const copy = getAftersignIoLoopCopy(state);
    const layer = document.createElement("section");
    document.body.appendChild(layer);

    const button = renderAftersignIoLoopAffordance(layer, copy);

    expect(button.textContent).toBe(copy.safeJobLabel);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(layer.textContent).toContain(copy.returnLine);
  });
});

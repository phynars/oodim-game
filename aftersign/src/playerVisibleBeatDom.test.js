import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_BEAT_ATTRIBUTE,
  AFTERSIGN_CHOICE_ATTRIBUTE,
  stampAftersignBeat,
  stampAftersignChoice,
} from "./playerVisibleBeatDom.js";

describe("AFTERSIGN player-visible beat DOM bridge", () => {
  it("stamps the rendered line with the current story beat", () => {
    const line = document.createElement("p");

    expect(stampAftersignBeat(line, "io-next-job")).toBe(true);
    expect(line.getAttribute(AFTERSIGN_BEAT_ATTRIBUTE)).toBe("io-next-job");
    expect(stampAftersignBeat(line, "io-next-job")).toBe(false);
  });

  it("stamps a visible choice with the tap-driven choice id and disabled state", () => {
    const button = document.createElement("button");

    expect(stampAftersignChoice(button, "ask-for-next-job", { disabled: false })).toBe(true);
    expect(button.getAttribute(AFTERSIGN_CHOICE_ATTRIBUTE)).toBe("ask-for-next-job");
    expect(button.disabled).toBe(false);

    expect(stampAftersignChoice(button, "ask-for-next-job", { disabled: true })).toBe(true);
    expect(button.getAttribute(AFTERSIGN_CHOICE_ATTRIBUTE)).toBe("ask-for-next-job");
    expect(button.disabled).toBe(true);
  });
});

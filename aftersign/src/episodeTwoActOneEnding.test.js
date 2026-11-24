import { beforeEach, describe, expect, it } from "vitest";

import {
  CURRENT_CONTENT_CONTINUATION,
  renderEpisodeTwoActOneEnding,
  renderEpisodeTwoCurrentContent,
} from "./episodeTwoActOneEnding.js";

// PR #3015 F1 — lineForBeat() in main.js calls renderEpisodeTwoActOneEnding
// on EVERY rAF frame while state.story.episodeTwoActOneEnded is true. After
// the player taps "Episode 2 — Act I complete", the end-of-current-content
// message must survive those repeated calls instead of being replaced by a
// rebuilt Act I card one frame later.

const ENDING = Object.freeze({
  id: "episode-two-act-one",
  jobName: "The Ledger Run",
  answer: "take",
  answerLine: "Niko: You took the shortcut.",
});

describe("Episode 2 Act I ending → current-content message", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="episodeOneEnding"></div><p id="line"></p>';
  });

  it("tapping the enabled continue button shows the current-content message", () => {
    let continued = 0;
    const card = renderEpisodeTwoActOneEnding(document, ENDING, () => {
      continued += 1;
      renderEpisodeTwoCurrentContent(document);
    });
    const button = card.querySelector('[data-episode-two-next-step="current-content-ending"]');
    expect(button.disabled).toBe(false);
    button.click();
    expect(continued).toBe(1);
    const host = document.getElementById("episodeOneEnding");
    expect(host.getAttribute("data-continuation")).toBe(CURRENT_CONTENT_CONTINUATION);
    expect(host.querySelector("[data-episode-two-current-content]").textContent).toContain(
      "end of current content",
    );
  });

  it("keeps the message across repeated per-frame renders (no Act I card rebuild)", () => {
    const onContinue = () => renderEpisodeTwoCurrentContent(document);
    const card = renderEpisodeTwoActOneEnding(document, ENDING, onContinue);
    card.querySelector("button").click();
    const host = document.getElementById("episodeOneEnding");
    const message = host.querySelector("[data-episode-two-current-content]");
    for (let frame = 0; frame < 60; frame += 1) {
      renderEpisodeTwoActOneEnding(document, ENDING, onContinue);
    }
    expect(host.querySelector(`[data-ending-id="${ENDING.id}"]`)).toBeNull();
    expect(host.querySelector("[data-episode-two-current-content]")).toBe(message);
    expect(host.getAttribute("data-continuation")).toBe(CURRENT_CONTENT_CONTINUATION);
  });

  it("still rebuilds the Act I card after a reset clears the continuation", () => {
    const card = renderEpisodeTwoActOneEnding(document, ENDING, () =>
      renderEpisodeTwoCurrentContent(document),
    );
    card.querySelector("button").click();
    const host = document.getElementById("episodeOneEnding");
    host.removeAttribute("data-continuation");
    host.replaceChildren();
    const rebuilt = renderEpisodeTwoActOneEnding(document, ENDING, () => {});
    expect(rebuilt.getAttribute("data-ending-id")).toBe(ENDING.id);
  });
});

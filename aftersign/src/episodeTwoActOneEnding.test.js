import { beforeEach, describe, expect, it } from "vitest";

import {
  ACT_TWO_OPENING_BEATS,
  ACT_TWO_OPENING_CONTINUATION,
  actTwoOpeningForStory,
  renderEpisodeTwoActOneEnding,
  renderEpisodeTwoActTwoOpening,
} from "./episodeTwoActOneEnding.js";

const ENDING = Object.freeze({
  id: "episode-two-act-one",
  jobName: "The Ledger Run",
  answer: "take",
  answerLine: "Niko: You took the shortcut.",
});

describe("Episode 2 Act I ending → Act II opening", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="episodeOneEnding"></div><p id="line"></p>';
  });

  it("shows a visible Continue to Act II control that invokes the continuation", () => {
    let continued = 0;
    const card = renderEpisodeTwoActOneEnding(document, ENDING, () => {
      continued += 1;
    });
    const button = card.querySelector('[data-episode-two-next-step="act-two-continuation"]');
    expect(button.textContent).toBe("Continue to Act II");
    expect(button.disabled).toBe(false);
    button.click();
    expect(continued).toBe(1);
  });

  it.each(["take", "refuse"])(
    "renders the %s Act II opening card with a stable id",
    (answer) => {
      const opening = actTwoOpeningForStory({
        beat: ACT_TWO_OPENING_BEATS[answer],
        story: { nikoShortcutAnswer: answer },
      });
      const card = renderEpisodeTwoActTwoOpening(document, opening);
      expect(card.getAttribute("data-act-two-opening-id")).toBe(ACT_TWO_OPENING_BEATS[answer]);
      expect(card.getAttribute("data-niko-shortcut-answer")).toBe(answer);
      expect(card.textContent).toContain("Act II");
      const host = document.getElementById("episodeOneEnding");
      expect(host.getAttribute("data-continuation")).toBe(ACT_TWO_OPENING_CONTINUATION);
    },
  );

  it("only resolves an Act II opening when its saved beat matches its saved answer", () => {
    expect(
      actTwoOpeningForStory({
        beat: ACT_TWO_OPENING_BEATS.take,
        story: { nikoShortcutAnswer: "refuse" },
      }),
    ).toBeNull();
    expect(actTwoOpeningForStory({ beat: "io-return-recognition", story: { nikoShortcutAnswer: "take" } })).toBeNull();
  });

  it("keeps the Act II opening across repeated per-frame renders of the Act I ending", () => {
    // Simulate: player tapped continue, Act II opening is now on screen;
    // lineForBeat's next frame still sees episodeTwoActOneEnded===true and
    // may try to re-render the Act I card. It must not overdraw the opening.
    const opening = actTwoOpeningForStory({
      beat: ACT_TWO_OPENING_BEATS.take,
      story: { nikoShortcutAnswer: "take" },
    });
    renderEpisodeTwoActTwoOpening(document, opening);
    const host = document.getElementById("episodeOneEnding");
    const openingCard = host.querySelector(`[data-act-two-opening-id="${ACT_TWO_OPENING_BEATS.take}"]`);
    for (let frame = 0; frame < 30; frame += 1) {
      renderEpisodeTwoActOneEnding(document, ENDING, () => {});
    }
    expect(host.querySelector(`[data-ending-id="${ENDING.id}"]`)).toBeNull();
    expect(host.querySelector(`[data-act-two-opening-id="${ACT_TWO_OPENING_BEATS.take}"]`)).toBe(openingCard);
    expect(host.getAttribute("data-continuation")).toBe(ACT_TWO_OPENING_CONTINUATION);
  });
});

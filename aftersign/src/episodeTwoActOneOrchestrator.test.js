import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACT_TWO_OPENING_BEATS,
  renderEpisodeTwoActOneOrchestration,
  resolveEpisodeTwoActOneOrchestration,
} from "./episodeTwoActOneOrchestrator.js";

describe("Episode 2 Act I orchestration", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="episodeOneEnding"></div><p id="line"></p>';
  });

  it("maps the selected door and accepted delivery to a job and Act I ending", () => {
    const { job, ending, actTwoOpening } = resolveEpisodeTwoActOneOrchestration({
      beat: "io-return-recognition",
      story: {
        doorChoice: "keep-official-record",
        episodeTwoAcceptedJobId: "ep2-ledger-run",
        nikoShortcutAnswer: "take",
      },
      delivery: { id: "ep2-sealed-ledger" },
    });

    expect(job).toMatchObject({ id: "ep2-ledger-run", deliveryId: "ep2-sealed-ledger" });
    expect(ending).toMatchObject({ id: "episode-two-act-one", answer: "take" });
    expect(actTwoOpening).toBeNull();
  });

  it("resolves the Act II opening when the saved beat matches the Niko answer", () => {
    const { actTwoOpening } = resolveEpisodeTwoActOneOrchestration({
      beat: ACT_TWO_OPENING_BEATS.refuse,
      story: { nikoShortcutAnswer: "refuse" },
    });
    expect(actTwoOpening).toMatchObject({
      id: ACT_TWO_OPENING_BEATS.refuse,
      answer: "refuse",
    });
  });

  it("does not render without either an Act II opening or an Act I ending", () => {
    expect(
      renderEpisodeTwoActOneOrchestration({ doc: document, ending: null, actTwoOpening: null }),
    ).toBeNull();
  });

  it("renders the Act I ending card and runs onContinueToActTwo when its control fires", () => {
    const onContinueToActTwo = vi.fn();
    const card = renderEpisodeTwoActOneOrchestration({
      doc: document,
      ending: Object.freeze({
        id: "episode-two-act-one",
        jobName: "The Ledger Run",
        answer: "take",
        answerLine: "Niko: You took the shortcut.",
      }),
      actTwoOpening: null,
      onContinueToActTwo,
    });
    expect(card?.getAttribute("data-ending-id")).toBe("episode-two-act-one");
    card.querySelector('[data-episode-two-next-step="act-two-continuation"]').click();
    expect(onContinueToActTwo).toHaveBeenCalledTimes(1);
  });

  it("renders the Act II opening directly when the resolved opening is passed in", () => {
    const opening = renderEpisodeTwoActOneOrchestration({
      doc: document,
      ending: null,
      actTwoOpening: Object.freeze({
        id: ACT_TWO_OPENING_BEATS.take,
        answer: "take",
        copy: "Act II — The clerk's lamp stays lit.",
      }),
    });
    expect(opening?.getAttribute("data-act-two-opening-id")).toBe(ACT_TWO_OPENING_BEATS.take);
    expect(opening?.getAttribute("data-niko-shortcut-answer")).toBe("take");
  });
});

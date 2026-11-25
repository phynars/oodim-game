import { describe, expect, it } from "vitest";
import {
  renderEpisodeTwoActOneOrchestration,
  resolveEpisodeTwoActOneOrchestration,
} from "./episodeTwoActOneOrchestrator.js";

describe("Episode 2 Act I orchestration", () => {
  it("maps the selected door and accepted delivery to a job and Act I ending", () => {
    const { job, ending } = resolveEpisodeTwoActOneOrchestration({
      story: {
        doorChoice: "keep-official-record",
        episodeTwoAcceptedJobId: "ep2-ledger-run",
        nikoShortcutAnswer: "take",
      },
      delivery: { id: "ep2-sealed-ledger" },
    });

    expect(job).toMatchObject({ id: "ep2-ledger-run", deliveryId: "ep2-sealed-ledger" });
    expect(ending).toMatchObject({ id: "episode-two-act-one", answer: "take" });
  });

  it("does not render without a resolved ending", () => {
    expect(renderEpisodeTwoActOneOrchestration({ doc: {}, ending: null })).toBeNull();
  });
});

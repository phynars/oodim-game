// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  BELL_ARCHIVE_OUTCOME_ATTRIBUTE,
  bellArchiveChoices,
  renderBellArchiveScene,
  resolveBellArchiveOutcome,
} from "./bellArchiveScene";
import { renderMaudBellArchive } from "../../../../aftersign/src/maudBellArchive.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("bellArchiveScene (#2691)", () => {
  it("resolves matched only for the sealed name", () => {
    expect(resolveBellArchiveOutcome("Ada", { name: "Ada" }).outcome).toBe("matched");
    expect(resolveBellArchiveOutcome("Mara Vell", { name: "Ada" }).outcome).toBe("unmatched");
  });

  it("offers the sealed name plus the live decoys", () => {
    expect(bellArchiveChoices("Ada").map((c) => c.name)).toEqual(["Ada", "Mara Vell", "Orra Bell"]);
  });

  it("renders Maud with visible name choices", () => {
    const scene = renderBellArchiveScene(document, {
      sealedName: "Ada",
      persistOutcome: () => undefined,
      showEndingCard: () => undefined,
    });
    expect(scene.getAttribute("data-beat")).toBe("maud-bell-archive");
    expect(scene.textContent).toContain("Maud Underbell");
    expect(scene.querySelectorAll("button[data-maud-name-choice]")).toHaveLength(3);
  });

  it("does not show the ending card until persistence resolves", async () => {
    let release: () => void = () => undefined;
    const persisted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const persistOutcome = vi.fn(() => persisted);
    const showEndingCard = vi.fn();
    const scene = renderBellArchiveScene(document, {
      sealedName: "Ada",
      persistOutcome,
      showEndingCard,
    });
    scene.querySelector<HTMLButtonElement>('[data-maud-name-choice="archive-decoy"]')!.click();
    await flush();
    expect(persistOutcome).toHaveBeenCalledTimes(1);
    expect(scene.getAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE)).toBe("unmatched");
    expect(showEndingCard).not.toHaveBeenCalled();
    release();
    await flush();
    expect(showEndingCard).toHaveBeenCalledTimes(1);
    expect(showEndingCard.mock.calls[0][1].outcome).toBe("unmatched");
  });

  it("still shows the card if persistence rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const showEndingCard = vi.fn();
    const scene = renderBellArchiveScene(document, {
      sealedName: "Ada",
      persistOutcome: () => Promise.reject(new Error("offline")),
      showEndingCard,
    });
    scene.querySelector<HTMLButtonElement>('[data-maud-name-choice="remembered-name"]')!.click();
    await flush();
    expect(showEndingCard).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("is the live renderer behind renderMaudBellArchive", async () => {
    document.body.innerHTML = '<div id="episodeOneEnding"></div>';
    let release: () => void = () => undefined;
    const onSelect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderMaudBellArchive(document, { storedName: "Ada", onSelect });
    const host = document.getElementById("episodeOneEnding")!;
    host.querySelector<HTMLButtonElement>('[data-maud-name-choice="remembered-name"]')!.click();
    await flush();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(host.querySelector("[data-ending-id]")).toBeNull();
    release();
    await flush();
    expect(host.querySelector('[data-ending-id="maud-bell-archive-lit"]')).not.toBeNull();
    expect(host.querySelector('[data-scene-id="bell-archive"]')?.getAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE)).toBe(
      "matched",
    );
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderMaudBellArchiveEnding } from "./maudBellArchive.js";

describe("renderMaudBellArchiveEnding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("centers the Begin Episode 2 continuation after a committed door choice", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const host = document.createElement("div");
    document.body.append(host);

    renderMaudBellArchiveEnding(
      document,
      host,
      { matchesMemory: true, name: "Niko" },
      { onBeginEpisodeTwo: vi.fn(), doorOpen: true, doorChoice: "keep-official-record" },
    );

    expect(host.querySelector("#beginEpisodeTwo")).not.toBeNull();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "center", inline: "nearest" });
  });
});

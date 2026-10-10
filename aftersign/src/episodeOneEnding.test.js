import { describe, expect, it, beforeEach } from "vitest";

import {
  EPISODE_ONE_ENDINGS,
  episodeOneEndingForPacket,
  renderEpisodeOneEnding,
  resolveEpisodeOneEnding,
} from "./episodeOneEnding.js";

// M3-E1 (#2261) — the Episode 1 ending has two reachable outcomes,
// each pinned to a CONCRETE prior action. These tests pin the
// resolver's truth table + the served-page renderer so a future
// refactor can't silently drop one of the two endings or let a false
// memory (ending-true when the red tag was withheld) through.

describe("resolveEpisodeOneEnding", () => {
  it("rings true only when the blue packet is sealed AND the red tag was carried", () => {
    expect(
      resolveEpisodeOneEnding({ packetSealed: true, redTagCarried: true }),
    ).toBe(EPISODE_ONE_ENDINGS.true);
    expect(EPISODE_ONE_ENDINGS.true.id).toBe("ending-bell-true");
    expect(EPISODE_ONE_ENDINGS.true.light).toBe("lit");
  });

  it("rings for the wrong name if the packet was opened", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: false,
      redTagCarried: true,
    });
    expect(ending).toBe(EPISODE_ONE_ENDINGS.false);
    expect(ending.id).toBe("ending-light-out");
    expect(ending.light).toBe("out");
  });

  it("rings for the wrong name if the red tag was withheld", () => {
    expect(
      resolveEpisodeOneEnding({ packetSealed: true, redTagCarried: false }),
    ).toBe(EPISODE_ONE_ENDINGS.false);
  });

  it("defaults to the light-out branch when called with no arguments", () => {
    expect(resolveEpisodeOneEnding()).toBe(EPISODE_ONE_ENDINGS.false);
  });

  it("surfaces concrete prior actions in both closing lines (no generic affinity line)", () => {
    expect(EPISODE_ONE_ENDINGS.true.ioLine).toMatch(/blue packet/i);
    expect(EPISODE_ONE_ENDINGS.true.ioLine).toMatch(/sealed/i);
    expect(EPISODE_ONE_ENDINGS.false.ioLine).toMatch(/red tag/i);
    expect(EPISODE_ONE_ENDINGS.false.ioLine).toMatch(/withheld/i);
  });
});

describe("episodeOneEndingForPacket (compat shim)", () => {
  it("maps sealed → ending-true and opened → ending-false", () => {
    expect(episodeOneEndingForPacket(true)).toBe(EPISODE_ONE_ENDINGS.true);
    expect(episodeOneEndingForPacket(false)).toBe(EPISODE_ONE_ENDINGS.false);
  });
});

describe("renderEpisodeOneEnding", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="episodeOneEnding"></div>';
  });

  it("stamps the ending-true card with the lit district light", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: true,
      redTagCarried: true,
    });
    const card = renderEpisodeOneEnding(document, ending);
    expect(card).not.toBeNull();
    const host = document.getElementById("episodeOneEnding");
    expect(host.querySelector("[data-ending-id]")?.getAttribute("data-ending-id")).toBe(
      "ending-bell-true",
    );
    expect(
      host.querySelector("[data-district-light]")?.getAttribute("data-district-light"),
    ).toBe("lit");
    expect(host.textContent).toMatch(/Saint Orra/);
    expect(host.textContent).toMatch(/blue packet sealed/);
  });

  it("stamps the ending-false card with the darkened district light", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: true,
      redTagCarried: false,
    });
    renderEpisodeOneEnding(document, ending);
    const host = document.getElementById("episodeOneEnding");
    expect(host.querySelector("[data-ending-id]")?.getAttribute("data-ending-id")).toBe(
      "ending-light-out",
    );
    expect(
      host.querySelector("[data-district-light]")?.getAttribute("data-district-light"),
    ).toBe("out");
    expect(host.textContent).toMatch(/wrong name/);
    expect(host.textContent).toMatch(/red tag/);
    expect(host.textContent).toMatch(/South district light: out/);
  });

  it("replaces prior ending content on a second render (no stale card beside the fresh one)", () => {
    renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true);
    renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.false);
    const host = document.getElementById("episodeOneEnding");
    const cards = host.querySelectorAll("[data-ending-id]");
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute("data-ending-id")).toBe("ending-light-out");
  });

  it("is a no-op when the host element is missing", () => {
    document.body.innerHTML = "";
    expect(renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true)).toBeNull();
  });
});

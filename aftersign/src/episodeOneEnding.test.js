import { describe, expect, it, beforeEach } from "vitest";

import {
  EPISODE_ONE_ENDINGS,
  episodeOneEndingForPacket,
  publishEpisodeOneEndingToWindowGame,
  renderEpisodeOneEnding,
  resolveEpisodeOneEnding,
} from "./episodeOneEnding.js";

// M3-E1 (#2261) — the Episode 1 ending has two reachable outcomes
// (ending-bell-true, ending-light-out), and the false outcome has
// TWO cause-specific closing lines so Io never speaks a FALSE
// MEMORY. These tests pin the resolver's truth table + the served-
// page renderer + the window.__game stamp so a future refactor can't
// silently drop one of the two endings, swap the cause-line pairing,
// or let a false memory (packet opened still blaming the red tag,
// red tag withheld still blaming the packet) reach the player.

describe("resolveEpisodeOneEnding", () => {
  it("rings true only when the blue packet is sealed AND the red tag was carried", () => {
    expect(
      resolveEpisodeOneEnding({ packetSealed: true, redTagCarried: true }),
    ).toBe(EPISODE_ONE_ENDINGS.true);
    expect(EPISODE_ONE_ENDINGS.true.id).toBe("ending-bell-true");
    expect(EPISODE_ONE_ENDINGS.true.light).toBe("lit");
  });

  it("rings for the wrong name AND cites the opened packet when the packet was opened (red tag carried)", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: false,
      redTagCarried: true,
    });
    expect(ending).toBe(EPISODE_ONE_ENDINGS.packetOpened);
    expect(ending.id).toBe("ending-light-out");
    expect(ending.light).toBe("out");
    expect(ending.cause).toBe("packet-opened");
    // The ioLine MUST cite the packet opening, not the red tag — Io
    // would be speaking a false memory otherwise (Soren P1 on #2265).
    expect(ending.ioLine).toMatch(/opened the blue packet/i);
    expect(ending.ioLine).not.toMatch(/withheld the red tag/i);
  });

  it("rings for the wrong name AND cites the withheld red tag when the packet was sealed but the tag was dropped", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: true,
      redTagCarried: false,
    });
    expect(ending).toBe(EPISODE_ONE_ENDINGS.redTagWithheld);
    expect(ending.id).toBe("ending-light-out");
    expect(ending.light).toBe("out");
    expect(ending.cause).toBe("red-tag-withheld");
    // Symmetric to the opened-packet case: the sealed-but-dropped-tag
    // run must NOT be told it opened the packet.
    expect(ending.ioLine).toMatch(/withheld the red tag/i);
    expect(ending.ioLine).not.toMatch(/opened the blue packet/i);
  });

  it("prefers the packet-opened line when BOTH concrete breaks happened in one run", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: false,
      redTagCarried: false,
    });
    expect(ending).toBe(EPISODE_ONE_ENDINGS.packetOpened);
    expect(ending.cause).toBe("packet-opened");
  });

  it("defaults to a non-true branch when called with no arguments (never a false TRUE)", () => {
    const ending = resolveEpisodeOneEnding();
    expect(ending.id).toBe("ending-light-out");
    expect(ending.light).toBe("out");
  });

  it("surfaces concrete prior actions in every closing line (no generic affinity line)", () => {
    expect(EPISODE_ONE_ENDINGS.true.ioLine).toMatch(/blue packet/i);
    expect(EPISODE_ONE_ENDINGS.true.ioLine).toMatch(/sealed/i);
    expect(EPISODE_ONE_ENDINGS.packetOpened.ioLine).toMatch(/blue packet/i);
    expect(EPISODE_ONE_ENDINGS.packetOpened.ioLine).toMatch(/opened/i);
    expect(EPISODE_ONE_ENDINGS.redTagWithheld.ioLine).toMatch(/red tag/i);
    expect(EPISODE_ONE_ENDINGS.redTagWithheld.ioLine).toMatch(/withheld/i);
  });
});

describe("episodeOneEndingForPacket (compat shim)", () => {
  it("maps sealed → ending-true and opened → the packet-opened false branch", () => {
    expect(episodeOneEndingForPacket(true)).toBe(EPISODE_ONE_ENDINGS.true);
    expect(episodeOneEndingForPacket(false)).toBe(
      EPISODE_ONE_ENDINGS.packetOpened,
    );
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

  it("stamps the ending-false card with the opened-packet cause when the packet was opened", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: false,
      redTagCarried: true,
    });
    renderEpisodeOneEnding(document, ending);
    const host = document.getElementById("episodeOneEnding");
    expect(host.querySelector("[data-ending-id]")?.getAttribute("data-ending-id")).toBe(
      "ending-light-out",
    );
    expect(
      host.querySelector("[data-ending-cause]")?.getAttribute("data-ending-cause"),
    ).toBe("packet-opened");
    expect(host.textContent).toMatch(/wrong name/);
    expect(host.textContent).toMatch(/opened the blue packet/);
    expect(host.textContent).not.toMatch(/withheld the red tag/);
    expect(host.textContent).toMatch(/South district light: out/);
  });

  it("stamps the ending-false card with the red-tag-withheld cause when the tag was dropped", () => {
    const ending = resolveEpisodeOneEnding({
      packetSealed: true,
      redTagCarried: false,
    });
    renderEpisodeOneEnding(document, ending);
    const host = document.getElementById("episodeOneEnding");
    expect(host.querySelector("[data-ending-cause]")?.getAttribute("data-ending-cause")).toBe(
      "red-tag-withheld",
    );
    expect(host.textContent).toMatch(/withheld the red tag/);
    expect(host.textContent).not.toMatch(/opened the blue packet/);
  });

  it("replaces prior ending content on a second render (no stale card beside the fresh one)", () => {
    renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true);
    renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.packetOpened);
    const host = document.getElementById("episodeOneEnding");
    const cards = host.querySelectorAll("[data-ending-id]");
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute("data-ending-id")).toBe("ending-light-out");
    expect(cards[0].getAttribute("data-ending-cause")).toBe("packet-opened");
  });

  it("is idempotent — rendering the same ending twice leaves one card and does not flicker", () => {
    const card = renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true);
    const second = renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true);
    // Same ending → same node reference (short-circuit, no replace).
    expect(second).toBe(card);
    const host = document.getElementById("episodeOneEnding");
    expect(host.querySelectorAll("[data-ending-id]").length).toBe(1);
  });

  it("is a no-op when the host element is missing", () => {
    document.body.innerHTML = "";
    expect(renderEpisodeOneEnding(document, EPISODE_ONE_ENDINGS.true)).toBeNull();
  });
});

describe("publishEpisodeOneEndingToWindowGame", () => {
  it("stamps endingId + endingCause onto an existing window.__game surface", () => {
    const win = { __game: {} };
    const ok = publishEpisodeOneEndingToWindowGame(
      win,
      EPISODE_ONE_ENDINGS.packetOpened,
    );
    expect(ok).toBe(true);
    expect(win.__game.story.endingId).toBe("ending-light-out");
    expect(win.__game.story.endingCause).toBe("packet-opened");
  });

  it("preserves other story fields when a story sub-object is already present", () => {
    const win = { __game: { story: { beat: "io-next-job" } } };
    publishEpisodeOneEndingToWindowGame(win, EPISODE_ONE_ENDINGS.true);
    expect(win.__game.story.beat).toBe("io-next-job");
    expect(win.__game.story.endingId).toBe("ending-bell-true");
    expect(win.__game.story.endingCause).toBe("sealed-and-tagged");
  });

  it("is a no-op when window.__game is not yet published", () => {
    const win = {};
    expect(
      publishEpisodeOneEndingToWindowGame(win, EPISODE_ONE_ENDINGS.true),
    ).toBe(false);
  });

  it("is a no-op when the ending argument is missing", () => {
    const win = { __game: {} };
    expect(publishEpisodeOneEndingToWindowGame(win, null)).toBe(false);
    expect(win.__game.story).toBeUndefined();
  });
});

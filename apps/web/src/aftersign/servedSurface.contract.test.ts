import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const readServedAftersignFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), "aftersign", relativePath), "utf8");

describe("Aftersign served surface contract", () => {
  it("boots the served vertical slice through its module entrypoint", () => {
    const html = readServedAftersignFile("index.html");

    expect(html).toContain('<script type="module" src="./main.js"></script>');
  });

  it("publishes the story, state, durable-save, and NPC-memory harness surface", () => {
    const main = readServedAftersignFile("main.js");

    expect(main).toContain("window.__game");
    expect(main).toContain("story");
    expect(main).toContain("state");
    expect(main).toContain("save");
    expect(main).toContain("load");
    expect(main).toContain("recognizesPlayer");
  });

  it("consumes the return-tone feel table on the shipped surface", () => {
    // Blocking review on PR #1205: a feel table with no shipped
    // consumer is dead code with green tests. main.js must import
    // the writer + selector and expose the runtime seam
    // (window.__game.applyReturnToneFeel); index.html must host a
    // [data-aftersign-return-surface] element for the CSS variables
    // to land on. Grep-level pins so a future refactor that
    // accidentally unwires the seam reds this test.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("applyAftersignReturnToneChoiceFeel");
    expect(main).toContain("AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR");
    expect(main).toContain("applyReturnToneFeel");

    const html = readServedAftersignFile("index.html");
    expect(html).toContain("data-aftersign-return-surface");
  });
});

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
    // Note: an earlier draft of this test also asserted
    // `expect(main).toContain("recognizesPlayer")`, but the served
    // `aftersign/main.js` does not expose that field — the
    // "recognizesPlayer" vocabulary belongs to the harness-side
    // `apps/web/src/aftersign/windowGameSurface.ts` snapshot, not the
    // raw window.__game object main.js publishes. main.js encodes NPC
    // recognition via `state.npcs.io.memory` + `trustPostureForOutcome`
    // (grep-visible in main.js), so a grep for the literal string
    // "recognizesPlayer" is a false pin here. Removed on PR #1205 —
    // Soren's review verified the assertion was dead code (never ran
    // until this PR added the file to `vitest.config.ts`) and is not
    // the contract main.js is meant to satisfy.
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

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
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const servedRuntime = readFileSync(
  resolve(here, "../../../../aftersign/main.js"),
  "utf8",
);

describe("route-return reload regression (#2322)", () => {
  it("does not encode an unresolved route acknowledgement as skipped on boot", () => {
    // `SECOND_ACTION.DONE` is the only positive evidence of listening;
    // `SECOND_ACTION.SKIPPED` is the only positive evidence of running early.
    // A saved return-choice screen has neither fact, so its boot memory must
    // leave routeAttention undefined and keep the neutral packet return line.
    expect(servedRuntime).toMatch(
      /secondActionFromMemory\(state\.npcs\.io\.memory\) === SECOND_ACTION\.SKIPPED\s*\? "skipped"\s*:\s*undefined/,
    );
  });
});

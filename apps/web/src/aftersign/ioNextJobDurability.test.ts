import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// #1358 refactor: `buildPersistPayload` moved verbatim to
// aftersign/src/runtime/persistence.js; the ask-for-next-job choice
// wiring and reload-restore branch still live in aftersign/main.js.
// Read both sources so each pinned assertion checks the module that
// actually owns it.
const mainSource = readFileSync(resolve(here, "../../../../aftersign/main.js"), "utf8");
const persistenceSource = readFileSync(
  resolve(here, "../../../../aftersign/src/runtime/persistence.js"),
  "utf8",
);

const extractBlock = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("io-next-job durability wiring", () => {
  it("stamps the parked next-job beat into every persisted payload", () => {
    const payloadBlock = extractBlock(
      persistenceSource,
      "const buildPersistPayload = ({ dirty = false } = {}) => ({",
      "const persist = ({ dirty = false } = {}) => {",
    );

    expect(payloadBlock).toContain("ioNextJob: buildIoNextJobDurabilityStamp({");
    expect(payloadBlock).toContain("beat: state.scene.beat");
    expect(payloadBlock).toContain("playerId: state.player.id");
    expect(payloadBlock).toContain("returnReason: state.player.returnReason");
    expect(payloadBlock).toContain("revision: state.save.revision");
  });

  it("force-saves immediately after the player asks Io for the next job", () => {
    const choiceBlock = extractBlock(
      mainSource,
      "if (choiceId === \"ask-for-next-job\") {",
      "if (choiceId === \"return-to-orra\") {",
    );

    expect(choiceBlock).toMatch(/setBeat\("io-next-job"\);\s+await forceSave\(\);/);
  });

  it("restores a matching parked stamp back to the next-job beat", () => {
    const reloadBlock = extractBlock(
      mainSource,
      "const ioNextJobStamp = saved.save && typeof saved.save === \"object\"",
      "// In-page reload of a delivered save must recognize the returning",
    );

    expect(reloadBlock).toContain("ioNextJobStamp.parked === true");
    expect(reloadBlock).toContain("ioNextJobStamp.beat === \"io-next-job\"");
    expect(reloadBlock).toContain("ioNextJobStamp.playerId === state.player.id");
    expect(reloadBlock).toContain("state.scene.beat = \"io-next-job\"");
    expect(reloadBlock).toContain("state.player.returnReason = ioNextJobStamp.returnReason");
  });
});

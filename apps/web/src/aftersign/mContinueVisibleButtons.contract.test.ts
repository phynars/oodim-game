import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const AFTERSIGN_MAIN = join(REPO_ROOT, "aftersign", "main.js");

function readAftersignMain(): string {
  return readFileSync(AFTERSIGN_MAIN, "utf8");
}

describe("M-CONTINUE visible button affordance", () => {
  it("keeps rendered route choices visible after Io recognition so the phone tap path cannot vanish", () => {
    const source = readAftersignMain();
    const renderTextStart = source.indexOf("const renderText = () => {");
    const packetChoiceBranchStart = source.indexOf("if (isPacketChoiceBeat)", renderTextStart);
    const renderTextSetup = source.slice(renderTextStart, packetChoiceBranchStart);

    expect(renderTextSetup).toContain("state.scene.beat === \"io-return-recognition\"");
    expect(renderTextSetup).toContain("state.scene.beat === \"return-tone-choice\"");
    expect(renderTextSetup).toContain("state.scene.beat === \"io-next-job\"");
    expect(renderTextSetup).toMatch(
      /routeChoiceVisible\s*=\s*isPacketChoiceBeat\s*\|\|\s*isReturnRecognitionBeat\s*\|\|\s*isReturnToneChoiceBeat\s*\|\|\s*isNextJobBeat/,
    );
  });
});

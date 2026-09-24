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

    expect(renderTextSetup).toContain("state.scene.beat === \"packet-delivered\"");
    expect(renderTextSetup).toContain("state.scene.beat === \"io-return-recognition\"");
    expect(renderTextSetup).toContain("state.scene.beat === \"return-tone-choice\"");
    expect(renderTextSetup).toContain("state.scene.beat === \"io-next-job\"");
    expect(renderTextSetup).toMatch(
      /routeChoiceVisible\s*=\s*isPacketChoiceBeat\s*\|\|\s*isPacketDeliveredBeat\s*\|\|\s*isReturnRecognitionBeat\s*\|\|\s*isReturnToneChoiceBeat\s*\|\|\s*isNextJobBeat/,
    );
    // The `packet-delivered` branch renders BEFORE `if (isPacketChoiceBeat)`
    // in `renderText()` (`if (isPacketDeliveredBeat) { ... } else if (isPacketChoiceBeat) { ... }`),
    // so the affordance stamps live inside `renderTextSetup`, not in the
    // post-packet-choice slice. Anchor both assertions to the region
    // where the branch actually appears — otherwise the slice starts
    // AFTER the delivered branch and the `toContain` misses it.
    expect(renderTextSetup).toContain("if (isPacketDeliveredBeat)");
    expect(renderTextSetup).toContain('stampAftersignChoice(deliverButton, "return-to-io")');
  });
});

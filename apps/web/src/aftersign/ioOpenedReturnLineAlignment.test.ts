import { describe, expect, it } from "vitest";

import { IO_OPENED_RETURN_LINE } from "../../../../aftersign/src/ioSealedReturn.ts";
import { AFTERSIGN_IO_FIRST_SCENE_DIALOGUE } from "./ioFirstSceneDialogue";
import { AFTERSIGN_IO_LINES } from "./ioVoiceContract";

// PR #2419 F1 — drift guard for Io's opened-return copy.
//
// The opened-return beat is spoken by three source modules:
//   1. `aftersign/src/ioSealedReturn.ts`      (IO_OPENED_RETURN_LINE — canonical)
//   2. `apps/web/src/aftersign/ioFirstSceneDialogue.ts`
//        → AFTERSIGN_IO_FIRST_SCENE_DIALOGUE[id="openedReturn"].text
//   3. `apps/web/src/aftersign/ioVoiceContract.ts`
//        → AFTERSIGN_IO_LINES.openedReturn.text
//
// All three MUST resolve to the same string. The earlier draft of this
// PR enforced the invariant with a module-load `throw` inside the
// served `aftersign/main.js`; that was risky — any TS-side load issue
// would abort the shipped module before `window.__game` was wired, so
// every e2e that reaches the recognition beats would silently time
// out. Moving the invariant to a pure vitest check keeps the drift
// guard without putting the whole served graph behind a `throw`.
describe("Io opened-return line — three-module alignment", () => {
  it("ioFirstSceneDialogue.openedReturn.text equals IO_OPENED_RETURN_LINE", () => {
    const openedReturn = AFTERSIGN_IO_FIRST_SCENE_DIALOGUE.find(
      (line) => line.id === "openedReturn",
    );
    expect(openedReturn).toBeDefined();
    expect(openedReturn?.text).toBe(IO_OPENED_RETURN_LINE);
  });

  it("ioVoiceContract.openedReturn.text equals IO_OPENED_RETURN_LINE", () => {
    expect(AFTERSIGN_IO_LINES.openedReturn.text).toBe(IO_OPENED_RETURN_LINE);
  });

  it("the two surface tables agree on the opened-return text verbatim", () => {
    const openedReturn = AFTERSIGN_IO_FIRST_SCENE_DIALOGUE.find(
      (line) => line.id === "openedReturn",
    );
    expect(openedReturn?.text).toBe(AFTERSIGN_IO_LINES.openedReturn.text);
  });
});

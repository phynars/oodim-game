import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Served-surface CONTRACT test: this file pins the shipped
// `aftersign/` vertical slice — the HTML entrypoint, `window.__game`
// publish shape, and the return-tone feel wiring — via grep-level
// string assertions against the raw served files. It is deliberately
// NOT a unit test of any single module. See PR #1205's review: a feel
// table (or any runtime seam) with no shipped consumer is dead code
// with green tests; these pins fail loudly if a future refactor
// unwires the seam.
//
// Unit-level coverage of the beat/choice DOM stamps lives next to the
// module itself, in `aftersign/src/playerVisibleBeatDom.test.js`.
// Do not duplicate those assertions here — this file's job is the
// served-page contract, not module behavior.

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

  it("consumes the tap-choice feel table on the shipped surface", () => {
    // Blocking review on PR #1230: same shape as the return-tone
    // precedent above — a 44px-minimum table with no consumer on the
    // served surface is green tests over dead code. main.js must
    // import the DOM reader + selector and expose the runtime seam
    // (window.__game.getTapChoiceFeelReport); index.html must stamp
    // `data-aftersign-tap-choice` on every button that COMMITS a fork
    // (packet gesture, the two route-memory forks, delivery). Any
    // future refactor that unwires the seam OR ships a new choice
    // button without the attribute reds this test.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("assertAftersignTapChoiceSurfaces");
    expect(main).toContain("AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR");
    expect(main).toContain("getTapChoiceFeelReport");

    const html = readServedAftersignFile("index.html");
    // The attribute must be on real served buttons — not a decorative
    // node the renderer never touches. Pin each of the four fork
    // commits by choice-id value so accidentally shipping a new
    // choice button without the attribute (or renaming the id in a
    // way that drops the attribute) reds here.
    expect(html).toContain('data-aftersign-tap-choice="packet"');
    expect(html).toContain('data-aftersign-tap-choice="acknowledge-kiosk"');
    expect(html).toContain('data-aftersign-tap-choice="skip-kiosk-acknowledge"');
    expect(html).toContain('data-aftersign-tap-choice="deliver-packet"');
  });

  it("consumes the tap-confirm feel envelope on the shipped surface", () => {
    // Blocking review on PR #1299: same shape as the return-tone
    // and tap-choice precedents above — a per-commit press envelope
    // with no consumer on the served surface is green tests over
    // dead code. `aftersign/main.js` must import the writer +
    // constant from `apps/web/src/aftersign/tapConfirmFeel.ts` AND
    // expose the runtime seam `window.__game.applyTapConfirmFeel`
    // AND call that seam from the four committing click handlers
    // (packet pointerup, acknowledgeRoute, skipRoute, deliver) so
    // every real tap that COMMITS a fork stamps the envelope on
    // the exact button the finger touched — not on the whole tray,
    // and not just in the vitest harness.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("applyFlagshipTapConfirmFeel");
    expect(main).toContain("FLAGSHIP_TAP_CONFIRM_FEEL");
    // The imported specifier — a rename in tapConfirmFeel.ts that
    // drops the file must red this pin.
    expect(main).toContain("../apps/web/src/aftersign/tapConfirmFeel.ts");
    // Runtime seam exposed on window.__game — the harness projects
    // the same shape via getAppliedTapConfirmFeel, so a consumer
    // spec can drive either surface with the same choice-id.
    expect(main).toContain("applyTapConfirmFeel");
    // Played-not-driven pin: at least one committing click handler
    // must actually invoke the seam. Any refactor that "cleans up"
    // the call sites reds here.
    expect(main).toContain('window.__game.applyTapConfirmFeel(');
  });

  it("consumes the pointer-to-render latency probe on the shipped surface", () => {
    // Blocking review on PR #1283: same shape as the return-tone
    // and tap-choice precedents above — a pointer-to-render feel
    // primitive with no consumer on the served surface is green
    // tests over dead code. `aftersign/main.js` must import
    // `measurePointerToRenderLatency` from
    // `./src/inputAcknowledgeLatency.ts`, wire a real
    // `pointerdown` capture-phase listener that timestamps intents
    // at `performance.now()`, drain them into samples after
    // `composer.render()` on each rAF tick, and expose the four
    // probe methods (`resetPointerToRenderLatency`,
    // `markPointerIntent`, `markPointerRendered`,
    // `getPointerToRenderLatencyReport`) on
    // `window.__game.input`. Any future refactor that unwires the
    // seam (removes the listener, moves the drain out of the tick,
    // drops a method) reds this test — the contract is that the
    // one-frame promise is measured against the REAL DOM on every
    // played frame, not just when a harness caller drives the
    // probe by hand.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("measurePointerToRenderLatency");
    expect(main).toContain("./src/inputAcknowledgeLatency.ts");
    // The four probe method names must appear as identifiers on
    // the shipped surface — bound as `window.__game.input.*`
    // downstream by the same shape the harness projects.
    expect(main).toContain("resetPointerToRenderLatency");
    expect(main).toContain("markPointerIntent");
    expect(main).toContain("markPointerRendered");
    expect(main).toContain("getPointerToRenderLatencyReport");
    // Played-not-driven pin: the intent side comes from a real DOM
    // `pointerdown` capture-phase listener; the render side drains
    // pending intents right after `composer.render()`. Both
    // strings must be present so a refactor that "cleans up" the
    // pointerdown listener OR moves the drain out of the tick reds
    // the seam.
    expect(main).toContain('document.addEventListener(\n    "pointerdown"');
    expect(main).toContain("drainPointerIntentsForRenderedFrame(performance.now())");
  });

  it("routes player-visible beat + choice stamps through the shared DOM bridge", () => {
    // PR #1231: `renderText()` in main.js used to set
    // `dataset.choiceId` / `disabled` inline on the three visible
    // buttons and never stamped the story beat onto the rendered
    // line. Both are now routed through
    // `aftersign/src/playerVisibleBeatDom.js` so a Playwright tap
    // spec can read the current beat + tap the correct choice via
    // DOM attributes rather than window.__game input hooks. This
    // pin fails if a refactor drops the import or reverts to the
    // inline dataset writes.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("stampAftersignBeat");
    expect(main).toContain("stampAftersignChoice");
    expect(main).toContain("./src/playerVisibleBeatDom.js");
  });
});

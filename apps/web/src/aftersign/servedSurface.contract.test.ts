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

// #1358: the raw `pointerdown` capture-phase listener + the four
// committing tap-choice click handlers moved verbatim out of
// `main.js` into `aftersign/src/runtime/inputAdapters.js`. main.js
// now imports `attachRuntimeInputAdapters` and calls it at boot with
// the DOM refs + game callbacks. The served-surface contract still
// holds — the shipped page consumes the same primitives — so pin the
// call site in main.js AND the moved literals in inputAdapters.js.
const readServedAftersignInputAdaptersSource = () =>
  readServedAftersignFile("src/runtime/inputAdapters.js");

describe("Aftersign served surface contract", () => {
  it("boots the served vertical slice through its module entrypoint", () => {
    const html = readServedAftersignFile("index.html");

    expect(html).toContain('<script type="module" src="./main.js"></script>');
  });

  it("wires Io's target-loss line from ioVoice.js into #targetLossPrompt at boot (#1829)", () => {
    // PR #1829 (Soren's fourth review) — the previous draft defined
    // `IO_TARGET_LOSS_LINE` in a sibling `aftersign/src/ioVoice.ts`
    // that NO SHIPPED CODE imported; main.js imports `./src/ioVoice.js`
    // (a different file). The line reached the DOM only because the
    // HTML literal was updated by hand, held in sync with the
    // orphan constant by a string-equality test — "two sources held
    // in sync, not one source driving the DOM." Soren's fix landed:
    // move the constant into the EXISTING `./src/ioVoice.js`, delete
    // the stem-colliding `.ts` sibling, and have main.js stamp the
    // constant onto `#targetLossPrompt.textContent` at boot so the
    // module is the SINGLE source and the HTML paragraph ships empty.
    //
    // This pin asserts the WIRE (import + stamp) instead of a string
    // mirror. A refactor that drops either half — the import, or the
    // stamp — reds here before any player-visible drift.
    const ioVoiceSource = readFileSync(
      join(process.cwd(), "aftersign", "src", "ioVoice.js"),
      "utf8",
    );
    const main = readServedAftersignFile("main.js");
    const html = readServedAftersignFile("index.html");

    // (a) The authored line lives in `./src/ioVoice.js` under the
    // named export `IO_TARGET_LOSS_LINE`. A rename that drops the
    // identifier reds here.
    const line = "The mark went quiet. Come back when you can hold the line.";
    expect(ioVoiceSource).toContain("export const IO_TARGET_LOSS_LINE");
    expect(ioVoiceSource).toContain(line);

    // (b) Stem-collision guard — no `aftersign/src/ioVoice.ts` may
    // exist alongside the `.js`. An extensionless import from a
    // future edit would resolve either file non-deterministically;
    // keeping the stem unique is the fix.
    expect(() =>
      readFileSync(
        join(process.cwd(), "aftersign", "src", "ioVoice.ts"),
        "utf8",
      ),
    ).toThrow();

    // (c) main.js imports the identifier from the served-lane
    // module (matching `IO_VOICE`/`ioReturnLine`'s existing import
    // shape). The regex tolerates the multi-line named-import form
    // main.js uses now that the list has three identifiers.
    expect(main).toMatch(
      /import[\s\S]{0,200}IO_TARGET_LOSS_LINE[\s\S]{0,200}from\s+"\.\/src\/ioVoice\.js"/,
    );

    // (d) main.js STAMPS the constant onto the rendered
    // `#targetLossPrompt` node's `textContent` at boot — the
    // played-not-driven contract. Import alone would be an orphan
    // again; the stamp is what makes the module drive the DOM.
    expect(main).toContain('document.getElementById("targetLossPrompt")');
    expect(main).toMatch(
      /getElementById\("targetLossPrompt"\)[\s\S]{0,200}textContent\s*=\s*IO_TARGET_LOSS_LINE/,
    );

    // (e) The paragraph ships EMPTY in the HTML source — the runtime
    // stamp is the sole source. If a future refactor re-hardcodes
    // the string in the HTML, that resurrects the two-source drift
    // Soren blocked #1829 on.
    expect(html).toMatch(
      /<p id="targetLossPrompt"[^>]*>\s*<\/p>/,
    );
    // Belt-and-braces: guard the pre-#1829 flat placeholder from
    // resurfacing on the shipped element.
    expect(html).not.toMatch(
      /<p id="targetLossPrompt"[^>]*>\s*Target lost\s*<\/p>/,
    );
  });

  it("ships the target-loss DOM surfaces for the packet-release wire-in", () => {
    // PR #1815: this pin used to assert `id="targetLostPrompt"` and
    // `id="reticle"` — a pair of inert placeholders that no wire-in
    // ever landed on. The REAL target-loss feedback ships on
    // `#aimReticle` + `#targetLossPrompt` (double-`s`, note the id
    // near-collision that made the old pin a readability trap); those
    // are the ids the sibling e2e
    // `aftersign/e2e/target-loss-feedback.spec.ts` drives and the ones
    // `aftersign/src/targetLossFeedback.ts` documents in its module
    // header. `id="targetLostPrompt"` was removed from `index.html`
    // in the same PR — its guard was dead-code accretion. `#reticle`
    // remains as a separate placeholder with its own history, but
    // isn't part of the target-loss render path so it's no longer
    // pinned here.
    const html = readServedAftersignFile("index.html");

    expect(html).toContain('id="aimReticle"');
    expect(html).toContain('id="targetLossPrompt"');
    // Bind-through: the real reticle carries the state marker the
    // e2e polls on release (`data-target-loss-active="true"` after
    // the pointerup edge). A rename that drops the attribute reds
    // this pin before the e2e has to.
    expect(html).toContain('data-target-loss-active');
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

  it("consumes the mobile tap-target adjacency feel on the shipped surface", () => {
    // Blocking review on PR #1313: same shape as the tap-choice
    // precedent above — an adjacency (overlap + too-close) contract
    // with no consumer on the served surface is green tests over
    // dead code. main.js must import the pure primitive from
    // `apps/web/src/aftersign/mobileTapTargetFeel.ts`, walk the same
    // `AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR` the size contract
    // uses (one source of truth for "what counts as a tap
    // target"), and expose the runtime seam
    // `window.__game.getMobileTapTargetFeelReport`. Any future
    // refactor that drops the import, renames the seam, or forks
    // the selector reds this pin.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("measureTapTargetAdjacency");
    expect(main).toContain(
      "../apps/web/src/aftersign/mobileTapTargetFeel.ts",
    );
    expect(main).toContain("getMobileTapTargetFeelReport");
    // Selector reuse: the adjacency probe MUST feed off the same
    // selector the size probe uses. A fork here would let a new
    // committing button ship with `data-aftersign-tap-choice` set
    // and still miss the adjacency check.
    expect(main).toContain("AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR");
    // Bind-through pin (Soren's review on this PR): the earlier
    // `toContain("measureTapTargetAdjacency")` is satisfied by the
    // import alone — a rename that updates the call site to
    // something else (e.g. `measureTapTargetFeel`) still passes.
    // Assert the exact CALL token so the imported binding is the
    // one actually invoked inside the seam.
    expect(main).toMatch(
      /getMobileTapTargetFeelReport:[\s\S]{0,600}measureTapTargetAdjacency\(/,
    );
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
    // #1358: the click handlers moved from main.js into
    // aftersign/src/runtime/inputAdapters.js; main.js now calls
    // `attachRuntimeInputAdapters(...)` at boot to wire them. Pin
    // the call site on main.js AND the actual invocation on the
    // adapters module — both must hold.
    expect(main).toContain("attachRuntimeInputAdapters(");
    const inputAdapters = readServedAftersignInputAdaptersSource();
    expect(inputAdapters).toContain('window.__game.applyTapConfirmFeel(');

    // CSS-consumer pins (PR #1299 re-review — "no stylesheet reads
    // `--aftersign-tap-confirm-*` or matches `[data-aftersign-tap-
    // confirm]`"). The JS writer stamps 9 CSS custom properties +
    // a dataset marker; without a stylesheet that CONSUMES them,
    // the envelope is invisible on the served page. Mirror the
    // return-tone precedent: the served index.html must (a) declare
    // inert defaults for every stamped variable (so the page parses
    // before the first beat), (b) match `[data-aftersign-tap-
    // confirm="armed"]` with a rule that reads the variables into
    // real paint channels (transform / transition / box-shadow /
    // animation), and (c) collapse the scale + shake channels under
    // `prefers-reduced-motion: reduce`. If a future refactor drops
    // the CSS block, this pin reds BEFORE anyone touches the JS.
    const html = readServedAftersignFile("index.html");
    // (a) all 9 stamped variables must have a default declaration
    // in :root so unarmed buttons still parse cleanly.
    expect(html).toContain("--aftersign-tap-confirm-press-scale");
    expect(html).toContain("--aftersign-tap-confirm-release-scale");
    expect(html).toContain("--aftersign-tap-confirm-press-ms");
    expect(html).toContain("--aftersign-tap-confirm-release-ms");
    expect(html).toContain("--aftersign-tap-confirm-release-easing");
    expect(html).toContain("--aftersign-tap-confirm-glow-px");
    expect(html).toContain("--aftersign-tap-confirm-glow-ms");
    expect(html).toContain("--aftersign-tap-confirm-shake-px");
    expect(html).toContain("--aftersign-tap-confirm-shake-ms");
    // (b) armed-selector consumer rule must exist. The reviewer's
    // strongest signal was that this string did not appear anywhere
    // in the repo; this pin locks the fix.
    expect(html).toContain('[data-aftersign-tap-confirm="armed"]');
    // Shake keyframes read the shake-px variable — locks the
    // animation binding so a refactor that drops the @keyframes
    // (or renames it) reds here.
    expect(html).toContain("@keyframes aftersign-tap-confirm-shake");
    // (c) reduced-motion respect — the armed selector must be
    // named inside a prefers-reduced-motion block that collapses
    // its animation/transform.
    expect(html).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*data-aftersign-tap-confirm="armed"/,
    );
  });

  it("consumes the pointer-to-render latency probe on the shipped surface", () => {
    // Blocking review on PR #1283: same shape as the return-tone
    // and tap-choice precedents above — a pointer-to-render feel
    // primitive with no consumer on the served surface is green
    // tests over dead code. `aftersign/main.js` must import
    // `createPointerToRenderLatencyRuntime` from
    // `./src/pointerToRenderRuntime.ts` (PR #1766 split the
    // frame-critical runtime out of `inputAcknowledgeLatency.ts` —
    // the pure `measurePointerToRenderLatency` primitive still lives
    // in that source module and is consumed internally by the
    // runtime factory), wire a real `pointerdown` capture-phase
    // listener that timestamps intents at `performance.now()`,
    // drain them into samples after `composer.render()` on each
    // rAF tick, and expose the four probe methods
    // (`resetPointerToRenderLatency`, `markPointerIntent`,
    // `markPointerRendered`, `getPointerToRenderLatencyReport`) on
    // `window.__game.input`. Any future refactor that unwires the
    // seam (removes the listener, moves the drain out of the tick,
    // drops a method) reds this test — the contract is that the
    // one-frame promise is measured against the REAL DOM on every
    // played frame, not just when a harness caller drives the
    // probe by hand.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("createPointerToRenderLatencyRuntime");
    expect(main).toContain("./src/pointerToRenderRuntime.ts");
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
    // #1358: the raw `document.addEventListener("pointerdown", ...)`
    // capture-phase listener moved from main.js into
    // aftersign/src/runtime/inputAdapters.js. main.js now wires it
    // via `attachRuntimeInputAdapters(...)` at boot. Pin the call
    // site on main.js AND the literal listener install on the
    // adapters module — the seam still holds if either would-be
    // regression (dropping the call site OR dropping the listener)
    // reds the test.
    expect(main).toContain("attachRuntimeInputAdapters(");
    const inputAdaptersForPointer = readServedAftersignInputAdaptersSource();
    expect(inputAdaptersForPointer).toContain(
      'document.addEventListener(\n    "pointerdown"',
    );
    expect(main).toContain("drainPointerIntentsForRenderedFrame(performance.now())");
  });

  it("renders the route/risk memory choice on the shipped surface (#1372, M-LOOP-E1)", () => {
    // Blocking review on PR #1375: same shape as the tap-choice /
    // return-tone / Orra first-name precedents above — a
    // `routeRiskMemory.ts` contract with no consumer on the served
    // surface is green tests over dead code. `aftersign/main.js`
    // must import the writer + the pure primitives from
    // `apps/web/src/aftersign/routeRiskMemory.ts`, restore
    // `state.player.routeRisk` from the durable save so the memory
    // fact round-trips across reload, render the two tappable route
    // buttons into `#routeRiskChoice` at the packet-choice beat, and
    // expose `window.__game.renderRouteRiskChoice` +
    // `window.__game.getOfferedActions` so a harness / dev overlay
    // sees the SAME divergent action-set the played surface does.
    const main = readServedAftersignFile("main.js");
    // Imported specifier — a rename in routeRiskMemory.ts must red.
    expect(main).toContain(
      "../apps/web/src/aftersign/routeRiskMemory.ts",
    );
    expect(main).toContain("renderRouteRiskChoice");
    expect(main).toContain("computeOfferedActions");
    expect(main).toContain("recordRouteRun");
    // Selector token from `routeRiskMemory.ts` — main.js imports
    // it alongside the writer + primitives, so a rename in the
    // module (or a refactor that drops the import) reds here.
    expect(main).toContain("AFTERSIGN_ROUTE_RISK_SURFACE_SELECTOR");
    // Durable-save restore path: the memory fact must be pulled off
    // `stored?.player?.routeRisk` so the persist payload's
    // `clone(state.player)` round-trips it across reload without a
    // new persistence branch.
    expect(main).toContain("stored?.player?.routeRisk");
    // Runtime seams on window.__game — same vocabulary a harness
    // uses to drive the beat.
    expect(main).toContain("window.__game.renderRouteRiskChoice");
    expect(main).toContain("window.__game.getOfferedActions");
    // Bind-through pin: the imported writer must actually be
    // INVOKED inside main.js against the shipped
    // `#routeRiskChoice` container — a rename that updates the
    // import but drops the call site (or forks the container ref)
    // still reds here.
    expect(main).toMatch(
      /renderRouteRiskChoice\(\{[\s\S]{0,600}container: routeRiskChoice,/,
    );

    // Served DOM container — the writer stamps buttons into a node
    // marked with `data-aftersign-route-risk-surface`, so the shipped
    // `index.html` must host that surface. A refactor that drops the
    // container leaves the writer with nowhere to render.
    const html = readServedAftersignFile("index.html");
    expect(html).toContain('id="routeRiskChoice"');
    expect(html).toContain("data-aftersign-route-risk-surface");
  });

  it("renders Saint Orra's first-name dialogue on the shipped surface", () => {
    // Blocking review on PR #1331: same shape as the return-tone /
    // tap-choice / tap-confirm precedents above — a frozen dialogue
    // contract with no consumer on the served surface is green tests
    // over dead code. `aftersign/main.js` must import
    // `renderOrraFirstNameDialogue` from
    // `apps/web/src/aftersign/orraFirstNameDialogue.ts` and expose
    // the runtime seam `window.__game.renderOrraFirstNameDialogue`
    // so a beat that reaches Saint Orra's pharmacy sign stamps her
    // voice into the shipped `#speaker` / `#line` nodes and stamps
    // `data-beat-id="orra-first-name"` + `data-choice-id` on the
    // rendered beat — the same DOM contract every other visible
    // beat satisfies. A refactor that unwires the import or renames
    // the seam reds this pin BEFORE any player-visible drift.
    const main = readServedAftersignFile("main.js");
    // The imported specifier — a rename in orraFirstNameDialogue.ts
    // that drops the file must red this pin.
    expect(main).toContain(
      "../apps/web/src/aftersign/orraFirstNameDialogue.ts",
    );
    expect(main).toContain("renderOrraFirstNameDialogue");
    // Runtime seam attached to window.__game — the harness / a
    // Playwright driver can invoke the same shape a vitest spec
    // does with the same choice-id vocabulary.
    expect(main).toContain("window.__game.renderOrraFirstNameDialogue");
  });

  it("consumes the cancel-failure sting writer on the shipped release funnel (#1871, Refs #1698)", () => {
    // Soren's REQUEST_CHANGES on PR #1871: draft 1 added
    // `apps/web/src/aftersign/packetCancelFailureSting.js` with
    // clean feel constants but NO importer on the served page.
    // AI006 "unconsumed surface" and AI003 "tautological test" —
    // the consumer test drove its own fabricated click handler,
    // not the shipped code. Draft 2's fix wires the writer into
    // `aftersign/src/runtime/inputAdapters.js` — the SAME adapter
    // module main.js calls via `attachRuntimeInputAdapters(...)`
    // at boot — so both the `pointerup` (capture-lost safety net)
    // and `pointercancel` (primary path) handlers on the shipped
    // `#packetButton` feed a gesture summary through the pure feel
    // judge and, on `reason: "cancelled"`, stamp
    // `playPacketCancelFailureSting(#packetButton, ...)` on the
    // very element the finger touched. Same shape as the
    // `applyTapConfirmFeel` wire above: one shipped adapter, one
    // DOM element, one served release funnel.
    const inputAdapters = readServedAftersignInputAdaptersSource();

    // (a) The writer is imported from the apps-lane module — a
    // rename in `packetCancelFailureSting.js` that drops the file
    // (or a refactor that unwires the import) reds this pin.
    expect(inputAdapters).toContain(
      "../../../apps/web/src/aftersign/packetCancelFailureSting.js",
    );
    expect(inputAdapters).toContain("playPacketCancelFailureSting");

    // (b) The pure feel judge is imported alongside — the adapter
    // must classify the gesture through the SHIPPED judge so the
    // `reason: "cancelled"` branch stays anchored to one source.
    expect(inputAdapters).toContain(
      "../../../apps/web/src/aftersign/packetChoiceFeel.ts",
    );
    expect(inputAdapters).toContain("evaluatePacketChoiceGesture");

    // (c) Both release-funnel handlers dispatch the writer. The
    // pointercancel path is the primary served entry; the
    // pointerup path is a capture-lost safety net. A refactor that
    // drops either call site reds here.
    // Bound is generous by design: the handlers carry explanatory
    // comment blocks (why `pointercancel` is the primary path, why
    // the `pointerup` site is defensive symmetry) that push the
    // dispatch call ~1.2KB past the anchor. 2000 keeps the pin
    // inside the same handler (a stray dispatch elsewhere in the
    // ~7KB file would still fail this) while giving the shipped
    // comments room to breathe. Soren's REQUEST_CHANGES on draft 2
    // called out the 800-char bound as too tight — this loosens it
    // per that feedback.
    expect(inputAdapters).toMatch(
      /packetButton\.addEventListener\("pointercancel"[\s\S]{0,2000}dispatchCancelFailureStingIfCancelled\(/,
    );
    expect(inputAdapters).toMatch(
      /packetButton\.addEventListener\("pointerup"[\s\S]{0,2000}dispatchCancelFailureStingIfCancelled\(/,
    );

    // (d) main.js still wires the adapter — the served page
    // consumes this file at boot. Same pin every other input-adapter
    // consumer above uses.
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("attachRuntimeInputAdapters(");
  });

  it("consumes the scene-transition feel envelope on the shipped surface", () => {
    // Blocking review on PR #1523: same shape as the return-tone /
    // tap-choice / tap-confirm / route-risk precedents above — an
    // `aftersignSceneTransitionFeel.ts` module imported ONLY by the
    // vitest boot harness (`apps/web/src/aftersign/harness/bootWindowGame.ts`)
    // was green tests over dead code. `aftersign/main.js` must
    // import the resolver + the pinned feel table from the module,
    // derive a scene id from every setBeat-mutated beat, and mount
    // `.aftersign-scene-transition` under
    // `[data-aftersign-scene-transition-surface]` on every real
    // scene boundary (kiosk → io-return, io-return → orra-return).
    // The runtime seams `window.__game.playSceneTransition` +
    // `window.__game.getSceneTransitionFeel` project the same
    // vocabulary a harness / dev overlay drives, and the sibling
    // e2e `aftersign/e2e/scene-transition-played.spec.ts` plays a
    // real tap and asserts the layer lands on the served DOM.
    const main = readServedAftersignFile("main.js");
    // Imported specifier — a rename in aftersignSceneTransitionFeel.ts
    // that drops the file must red this pin.
    expect(main).toContain(
      "../apps/web/src/aftersign/aftersignSceneTransitionFeel.ts",
    );
    // Both bindings must be imported — the writer AND the pinned
    // table. Missing either leaves the seam half-wired.
    expect(main).toContain("resolveAndPlayAftersignSceneTransition");
    expect(main).toContain("AFTERSIGN_SCENE_TRANSITION_FEEL");
    // Runtime seams on window.__game — same vocabulary the harness
    // projects; a rename here reds the played-page consumer.
    expect(main).toContain("window.__game.playSceneTransition");
    expect(main).toContain("window.__game.getSceneTransitionFeel");
    // Bind-through pin: the beat→scene mapping must actually FEED
    // the resolver — a "cleanup" refactor that keeps the helper but
    // drops the invocation from setBeat leaves the seam ornamental.
    // Assert setBeat calls the transition wiring so the played page
    // gets a layer on every real beat advance.
    expect(main).toContain("sceneIdForBeat");
    expect(main).toContain("playSceneTransitionForBeatChange(");

    // Served DOM container — the writer stamps
    // `.aftersign-scene-transition` under a node marked with
    // `data-aftersign-scene-transition-surface`, so the shipped
    // `index.html` must host that surface AND declare a consuming
    // CSS rule + inert :root defaults (same shape as the
    // tap-confirm block above).
    const html = readServedAftersignFile("index.html");
    expect(html).toContain('id="aftersignSceneTransitionSurface"');
    expect(html).toContain("data-aftersign-scene-transition-surface");
    // Inert defaults so the rule parses before the first beat.
    expect(html).toContain("--aftersign-scene-transition-total-ms");
    expect(html).toContain("--aftersign-scene-transition-camera-drift-px");
    expect(html).toContain("--aftersign-scene-transition-camera-roll-deg");
    expect(html).toContain("--aftersign-scene-transition-vignette-alpha");
    expect(html).toContain("--aftersign-scene-transition-bloom-alpha");
    // Consumer rule + reduced-motion collapse — the writer's dataset
    // stamps are drained INTO these channels; without the rule the
    // envelope stays invisible on the served page.
    expect(html).toContain(".aftersign-scene-transition {");
    expect(html).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.aftersign-scene-transition/,
    );
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

  it("wires the kiosk scene visual through ioReturnLineFeedback.js (#1867)", () => {
    // PR #1867 (Soren's REQUEST_CHANGES) — an earlier draft shipped
    // `apps/web/src/aftersign/kioskSceneVisual.js` with zero consumers:
    // main.js never imported it, so the served `#ioReturnLine` beat
    // never mounted the treatment. Same shape as the return-tone /
    // tap-confirm precedents above (a pure CSS/DOM writer with no
    // shipped consumer is green tests over dead code). The wire lands
    // by co-locating the writer with the served lane
    // (`aftersign/src/kioskSceneVisual.js`) and importing it from
    // `aftersign/src/ioReturnLineFeedback.js` — which main.js's
    // `renderText()` already invokes on the real `#ioReturnLine`
    // element at the recognition beat (see `aftersign/e2e/
    // io-voice-served.spec.ts`). The feedback writer passes
    // `element.parentElement` — the `.panel` node that contains
    // both `#line` and `#ioReturnLine` — so the treatment is scoped
    // to the surface Io's return voice is stamped into.
    //
    // A refactor that drops either half (the served-lane module OR
    // the import from the feedback writer) reds this pin BEFORE any
    // player-visible regression.
    const feedbackSource = readServedAftersignFile(
      "src/ioReturnLineFeedback.js",
    );
    // (a) The import specifier — a rename in kioskSceneVisual.js
    // that drops the file must red this pin.
    expect(feedbackSource).toContain(
      'import { applyKioskSceneVisual } from "./kioskSceneVisual.js"',
    );
    // (b) Played-not-driven pin: the imported writer must actually
    // be INVOKED inside the feedback writer against the element's
    // parent — a rename that updates the import but drops the call
    // site still reds here.
    expect(feedbackSource).toContain("applyKioskSceneVisual(element.parentElement)");

    // (c) The served-lane module exports the named symbol — a
    // refactor that renames the export reds here before the import
    // in (a) resolves to `undefined` at runtime.
    const visualSource = readServedAftersignFile("src/kioskSceneVisual.js");
    expect(visualSource).toContain("export function applyKioskSceneVisual");
    // (d) The scoped CSS the writer stamps must target the
    // sibling `#ioReturnLine` paragraph — a refactor that
    // renames the id (or drops the scoping) reds here.
    expect(visualSource).toContain(".aftersign-kiosk-scene #ioReturnLine");
    // (e) Stem-collision guard — the old orphan module lived at
    // `apps/web/src/aftersign/kioskSceneVisual.js` with no consumer.
    // Assert it stays deleted so a future edit that resurrects the
    // orphan reds here.
    expect(() =>
      readFileSync(
        join(
          process.cwd(),
          "apps/web/src/aftersign/kioskSceneVisual.js",
        ),
        "utf8",
      ),
    ).toThrow();
  });

  it("wires the sibling return-line tactile feedback through main.js (#1901)", () => {
    // Blocking review on PR #1901 (Soren Vask): the earlier draft
    // shipped a sibling `aftersign/return-line-tactile.js` alongside
    // the existing `aftersign/src/ioReturnLineFeedback.js` writer,
    // but exported the SAME identifier name (`playIoReturnLineFeedback`)
    // — so main.js's named import
    // `import { playIoReturnLineTactileFeedback } from "./return-line-tactile.js"`
    // never resolved. Served as native ESM (`<script type="module">`),
    // that throws `SyntaxError` at module evaluation and black-screens
    // the game on boot; under a bundler, the identifier is `undefined`
    // and the per-frame call inside `renderText()` reds every tick.
    //
    // No test caught it because the sibling module wasn't pinned —
    // only `ioReturnLineFeedback.js` (the audio/visual sibling) had a
    // servedSurface pin. Same shape as the tap-confirm / kiosk-scene
    // precedents above: a writer with no shipped-import proof is dead
    // code with green tests. Lock (a) the sibling exports the
    // distinct name `playIoReturnLineTactileFeedback`, (b) main.js
    // imports it from `./return-line-tactile.js`, and (c) main.js
    // invokes the imported binding inside `renderText()` on the same
    // `returnPara` node the sibling audio-visual writer already
    // consumes — so both feedbacks layer on the exact DOM element the
    // player sees.
    const tactileSource = readServedAftersignFile("return-line-tactile.js");
    const main = readServedAftersignFile("main.js");

    // (a) The sibling module MUST export the tactile-suffixed name.
    // A rename that drops the `Tactile` token (the exact regression
    // Soren blocked) reds this pin before boot.
    expect(tactileSource).toContain(
      "export function playIoReturnLineTactileFeedback",
    );
    // Guard the collision-prone shape: the sibling must NOT re-export
    // `playIoReturnLineFeedback` (that name belongs to the sibling
    // audio-visual writer in `src/ioReturnLineFeedback.js`).
    expect(tactileSource).not.toMatch(
      /export\s+(?:function|const|let|var)\s+playIoReturnLineFeedback\b/,
    );

    // (b) main.js imports the tactile writer from the served-lane
    // sibling. The path is the same relative shape the existing
    // `./src/ioReturnLineFeedback.js` import uses on the line above.
    expect(main).toMatch(
      /import\s*\{\s*playIoReturnLineTactileFeedback\s*\}\s*from\s+"\.\/return-line-tactile\.js"/,
    );

    // (c) Bind-through pin — the imported binding must actually be
    // INVOKED inside `renderText()` on the `returnPara` DOM node. A
    // refactor that keeps the import but drops the call site (or
    // forks the argument off a different reference) still reds here.
    // Layered on top of the audio-visual sibling: both writers must
    // fire on the same node so the tactile treatment stamps on the
    // exact paragraph that flashed.
    expect(main).toMatch(
      /playIoReturnLineTactileFeedback\(returnPara,\s*returnOutcome\)/,
    );

    // (d) AI006 — CSS consumer for the stamped custom property.
    // Soren's second block: the earlier draft stamped
    // `--io-return-accent` on `element.style` but NO stylesheet
    // read it — dead-on-arrival, same shape the tap-confirm
    // precedent above pins against (`[data-aftersign-tap-
    // confirm="armed"]` rule reads its stamped vars). Fix: the
    // tactile module now injects an idempotent stylesheet whose
    // rule consumes the property via `var(--io-return-accent)`.
    // Pin BOTH the stamp AND the consumer so a refactor that
    // drops either half reds here BEFORE the CI e2e catches it
    // at runtime.
    expect(tactileSource).toContain(
      'element.style.setProperty("--io-return-accent"',
    );
    // The consumer rule scopes to `#ioReturnLine` (same target
    // the audio-visual and kiosk-scene siblings paint) and reads
    // the stamped property via `var(...)`. A fallback keyword is
    // required so off-beat frames parse cleanly — matches the
    // return-tone-feel + tap-confirm shapes above.
    expect(tactileSource).toMatch(/#ioReturnLine\s*\{[\s\S]*var\(--io-return-accent/);
    // The injected `<style>` node carries a stable id so the
    // mount is idempotent under `renderText()`'s per-frame
    // re-arms. Same shape as `kioskSceneVisual.js`'s
    // `aftersign-kiosk-visual-style`.
    expect(tactileSource).toContain(
      '"aftersign-return-line-tactile-style"',
    );

    // (e) AI007 — played witness for the tactile stamp. The
    // served e2e (`aftersign/e2e/io-voice-served.spec.ts`) must
    // assert `data-io-return-tactile-outcome` on `#ioReturnLine`
    // after a real gesture on BOTH branches (sealed + opened).
    // Soren's block: without this the source-grep above only
    // proves "both writers are colocated in main.js source" —
    // not "both writers actually fire on the same node in a
    // real browser". The runtime witness is the load-bearing
    // proof, mirroring how the audio-visual sibling is pinned by
    // its `data-io-return-feedback` runtime witness in the same
    // file.
    const servedE2eSource = readFileSync(
      join(
        process.cwd(),
        "aftersign",
        "e2e",
        "io-voice-served.spec.ts",
      ),
      "utf8",
    );
    // Two assertions — one per branch — on the SAME attribute
    // the tactile writer stamps (`element.dataset.
    // ioReturnTactileOutcome = outcome`, which surfaces on the
    // DOM as `data-io-return-tactile-outcome`).
    const tactileWitnessMatches = servedE2eSource.match(
      /toHaveAttribute\(\s*"data-io-return-tactile-outcome"/g,
    );
    expect(tactileWitnessMatches).not.toBeNull();
    expect(tactileWitnessMatches?.length ?? 0).toBeGreaterThanOrEqual(2);
    // The witnesses must live on the same `#ioReturnLine`
    // locator the audio-visual witness above uses — proving
    // "both feedbacks fire on the SAME node," which is the exact
    // wire-in claim source-grep alone can't back.
    expect(servedE2eSource).toContain(
      'const returnLine = page.locator("#ioReturnLine")',
    );
  });

  it("consumes the packet-press logic-side feedback envelope on the shipped surface (#1879)", () => {
    // Blocking review on PR #1879 (Mara Okonkwo): `packetPress(input)`
    // calls `playPacketPressFeedback()`, which stamps
    // `data-packet-press-feedback="pressed"` on `#packetButton` — but
    // a repo-wide grep for that attribute returned ZERO CSS readers.
    // Every sibling envelope (tap-confirm, packet-press pointer,
    // route-choice-press, job-take) ships a paint rule; this one
    // didn't. Same shape as the return-tone / tap-confirm precedents
    // above — a JS writer with no CSS consumer is a green test over
    // an invisible envelope.
    //
    // The fix has three parts: (1) main.js imports the pure
    // begin/advance functions and drives the rAF-ticked state, (2)
    // index.html declares `--aftersign-packet-press-feedback-*` vars
    // + a CSS consumer rule on `#packetButton[data-packet-press-feedback="pressed"]`,
    // and (3) `aftersign/packetPressFeedbackServedContract.ts` (a
    // pure-runner-registered contract) pins the CSS var value against
    // the numeric `PACKET_PRESS_FEEDBACK_MS` constant in
    // `aftersign/src/packet-press-feedback.ts`. This vitest pin locks
    // the vertical slice — main.js WIRE + index.html CONSUMER — so a
    // future refactor that unwires either half reds here BEFORE any
    // player-visible drift.
    const main = readServedAftersignFile("main.js");
    // (a) main.js imports the pure begin/advance from the served-lane
    // module. A rename in `packet-press-feedback.ts` that drops
    // either export reds this pin.
    expect(main).toContain("./src/packet-press-feedback.ts");
    expect(main).toContain("beginPacketPressFeedback");
    expect(main).toContain("advancePacketPressFeedback");
    // (b) `packetPress` actually invokes the writer — a refactor
    // that "cleans up" the call site (import kept, invocation
    // dropped) reds here.
    expect(main).toContain("playPacketPressFeedback(");
    // (c) The stamp lands on `#packetButton.dataset.packetPressFeedback`
    // — the very attribute the CSS consumer rule keys off. A rename
    // that forks the attribute name silently unwires the paint.
    expect(main).toMatch(
      /packetButton\.dataset\.packetPressFeedback\s*=/,
    );

    const html = readServedAftersignFile("index.html");
    // (d) The three CSS variables the consumer rule reads must have
    // :root defaults so the page parses cleanly before any press.
    expect(html).toContain("--aftersign-packet-press-feedback-hold-ms");
    expect(html).toContain("--aftersign-packet-press-feedback-scale-from");
    expect(html).toContain("--aftersign-packet-press-feedback-easing");
    // (e) The consumer rule must exist on the exact
    // `#packetButton[data-packet-press-feedback="pressed"]` selector
    // — the pattern the JS writer stamps.
    expect(html).toContain(
      '#packetButton[data-packet-press-feedback="pressed"]',
    );
    // (f) Reduced-motion respect — the pressed selector must appear
    // inside a `prefers-reduced-motion: reduce` block that collapses
    // its transform. Same discipline as the pointer-driven packet-press
    // envelope above.
    expect(html).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}data-packet-press-feedback="pressed"/,
    );
  });
});

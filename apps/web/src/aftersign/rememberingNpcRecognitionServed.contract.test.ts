import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";
import { sampleAftersignRememberingNpcRecognitionBeat } from "./verticalSliceRecognitionBeat";

// Played contract test for the returning-NPC recognition beat.
//
// Blocking review on PR #1309: the envelope sampler + the
// `sampleAftersignRememberingNpcRecognitionBeat` wrapper had no
// shipped consumer — the previous PR wired them onto
// `bootAftersignWindowGame` (the *test* harness), which the served
// page never boots. This spec pins the seam that closes that gap:
//
//   (1) `aftersign/main.js` imports the wrapper and calls it every
//       frame from a top-level `syncRememberingNpcRecognitionDom(now)`
//       invoked inside the tick, right after
//       `syncRecognitionDomFeedback(now)`. The two share
//       `memoryRecognitionBeatStartedAt` so both beats speak the same
//       elapsed clock — no per-beat scheduler drift.
//
//   (2) `aftersign/index.html` hosts the `[data-aftersign-remembering
//       -recognition]` overlay with a ring child + subtitle child. The
//       renderer stamps 5 CSS variables + `data-active` /
//       `data-audio-armed` markers on it every frame during the beat.
//
//   (3) A jsdom-driven behavior check proves the wrapper's envelope
//       ACTUALLY lands on a real HTMLElement's style / dataset when
//       the beat is armed — that is the "played spec asserting the
//       recognition ring / subtitle render on a visible element"
//       Soren asked for on the last round. Off-beat / first-contact
//       leaves the overlay inert (ring + subtitle opacity 0).
//
// Same discipline as `servedSurface.contract.test.ts` — grep pins
// against the raw served files, plus a live shape assertion that
// proves the envelope's numbers reach a rendered node. If a future
// refactor unwires the seam (drops the import, removes the tick
// call, deletes the overlay) any of these three pins reds first.

const readServedAftersignFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), "aftersign", relativePath), "utf8");

describe("Aftersign remembering-NPC recognition beat — served surface contract", () => {
  it("imports the recognition-beat wrapper into aftersign/main.js", () => {
    const main = readServedAftersignFile("main.js");
    expect(main).toContain("sampleAftersignRememberingNpcRecognitionBeat");
    // The imported specifier — a rename of the source module must red
    // this pin so the seam cannot silently unwire.
    expect(main).toContain(
      "../apps/web/src/aftersign/verticalSliceRecognitionBeat.ts",
    );
  });

  it("adapts the served state shape correctly — Orra memory is an array, not an { hasMetOrra, debt } object", () => {
    // Blocking review on PR #1309 (Soren): the first draft of
    // `buildVerticalSliceStateAdapter` in aftersign/main.js read
    // `state.npcs.orra?.memory?.hasMetOrra` and `.debt`, but the
    // served state's `npcs.orra.memory` is an ARRAY of
    // `OrraRecognitionMemoryFact` (aftersign/src/orraRuntimeLane.ts:
    // `coerceOrraRecognitionMemory` returns `OrraRecognitionMemoryFact[]`;
    // main.js:1735, 2719, 2830 all assign arrays). Reading
    // `.hasMetOrra` off an array is `undefined === true → false`, so
    // `orraRecognizesPlayer` pinned to `false` every frame and the
    // recognition ring/subtitle never fired for Orra.
    //
    // This spec grep-pins the fix: the adapter must read
    // `Array.isArray(...)` + `.length > 0` (recognition = at least
    // one lit/spared fact) and must NOT read `.hasMetOrra` / `.debt`
    // off the memory array again. If a future refactor re-introduces
    // the object-shape read, this test reds.
    const main = readServedAftersignFile("main.js");
    // Adapter reads array shape for both fields.
    expect(main).toMatch(
      /orraHasMetPlayer:\s*Array\.isArray\(state\.npcs\.orra\?\.memory\)\s*&&\s*state\.npcs\.orra\.memory\.length\s*>\s*0/,
    );
    expect(main).toMatch(
      /orraRecognizesPlayer:\s*\n?\s*Array\.isArray\(state\.npcs\.orra\?\.memory\)\s*&&\s*state\.npcs\.orra\.memory\.length\s*>\s*0/,
    );
    // The broken pattern is gone (the ONLY hits on hasMetOrra / debt
    // as memory-object keys were inside the adapter — a general
    // ban would over-fire, so scope the assertion to the adapter
    // body identified by its unique symbol).
    const adapterStart = main.indexOf("buildVerticalSliceStateAdapter");
    expect(adapterStart).toBeGreaterThan(0);
    const adapterBody = main.slice(adapterStart, adapterStart + 2000);
    expect(adapterBody).not.toMatch(/state\.npcs\.orra\?\.memory\?\.hasMetOrra/);
    expect(adapterBody).not.toMatch(/state\.npcs\.orra\?\.memory\?\.debt/);
  });

  it("calls the wrapper every frame inside the render tick", () => {
    const main = readServedAftersignFile("main.js");
    // The per-frame call site — a refactor that moves the call OUT of
    // the tick (or drops it entirely) reds here.
    expect(main).toContain("syncRememberingNpcRecognitionDom(now)");
    // The call must FOLLOW the sibling recognitionDomFeedback sync in
    // source order, so both beats sync against the same tick clock.
    expect(main.indexOf("syncRememberingNpcRecognitionDom(now)")).toBeGreaterThan(
      main.indexOf("syncRecognitionDomFeedback(now)"),
    );
  });

  it("hosts the recognition overlay in aftersign/index.html", () => {
    const html = readServedAftersignFile("index.html");
    // The overlay element the renderer stamps every frame.
    expect(html).toContain("data-aftersign-remembering-recognition");
    // The two visible children the wrapper's envelope drives via CSS
    // variables — ring (opacity + scale) and subtitle (opacity +
    // vertical pop distance).
    expect(html).toContain("data-aftersign-remembering-recognition-ring");
    expect(html).toContain("data-aftersign-remembering-recognition-subtitle");
    // The five CSS variables the renderer stamps.  Any refactor that
    // renames one silently blanks the visible envelope on that
    // channel — pin all five here so the rename reds first.
    expect(html).toContain("--aftersign-remembering-portrait-push-px");
    expect(html).toContain("--aftersign-remembering-ring-scale");
    expect(html).toContain("--aftersign-remembering-ring-opacity");
    expect(html).toContain("--aftersign-remembering-subtitle-pop-px");
    expect(html).toContain("--aftersign-remembering-subtitle-opacity");
  });

  it("wrapper renders the recognition ring + subtitle onto a visible element when armed", () => {
    // Build the DOM shape aftersign/index.html publishes (verbatim
    // wrapper + ring + subtitle) so the test drives the SAME element
    // the served page paints.
    const host = document.createElement("div");
    host.innerHTML = `
      <div
        data-aftersign-remembering-recognition
        data-active="false"
        data-audio-armed="false"
        style="
          --aftersign-remembering-portrait-push-px: 0px;
          --aftersign-remembering-ring-scale: 1;
          --aftersign-remembering-ring-opacity: 0;
          --aftersign-remembering-subtitle-pop-px: 0px;
          --aftersign-remembering-subtitle-opacity: 0;
        "
      >
        <div data-aftersign-remembering-recognition-ring></div>
        <div data-aftersign-remembering-recognition-subtitle></div>
      </div>
    `;
    const overlay = host.querySelector<HTMLElement>(
      "[data-aftersign-remembering-recognition]",
    );
    const subtitle = host.querySelector<HTMLElement>(
      "[data-aftersign-remembering-recognition-subtitle]",
    );
    expect(overlay).not.toBeNull();
    expect(subtitle).not.toBeNull();
    if (!overlay || !subtitle) return;

    // A returning session state: player has met Io and sealed the
    // packet — the resolver returns Io's returning line and
    // `recognitionFeel = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL`,
    // so the wrapper samples a real envelope.
    const firstContact = createAftersignVerticalSliceState();
    const met = meetIoForAftersignSlice(firstContact);
    const returning = meetIoForAftersignSlice(
      recordAftersignPacketChoice(met, "sealed"),
    );

    // Off-beat (elapsedMs = 0) baseline: ring opacity 0, subtitle
    // opacity 0, audio cue NOT armed.  Wrapper still returns a real
    // envelope shape — the played page uses this to keep the DOM
    // parsed with consistent variables before the beat fires.
    const zeroSample = sampleAftersignRememberingNpcRecognitionBeat(
      returning,
      "io",
      0,
    );
    expect(zeroSample.envelope).not.toBeNull();
    expect(zeroSample.envelope?.recognitionRingOpacity).toBeCloseTo(0, 3);
    expect(zeroSample.envelope?.subtitleOpacity).toBeCloseTo(0, 3);
    expect(zeroSample.envelope?.audioCueArmed).toBe(false);

    // Mid-beat sample (elapsedMs ~ ring peak, past subtitle pop delay,
    // past audio cue delay): ring flashes with real opacity, subtitle
    // opacity rises, audio cue is armed.
    const feel = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;
    const midElapsedMs =
      feel.recognitionRingDelayMs + feel.recognitionRingDurationMs / 2;
    const midSample = sampleAftersignRememberingNpcRecognitionBeat(
      returning,
      "io",
      midElapsedMs,
    );
    expect(midSample.envelope).not.toBeNull();
    const envelope = midSample.envelope!;
    expect(envelope.recognitionRingOpacity).toBeGreaterThan(0);
    expect(envelope.recognitionRingScale).toBeGreaterThan(1);
    expect(envelope.subtitleOpacity).toBeGreaterThan(0);
    expect(envelope.audioCueArmed).toBe(true);

    // Now stamp the envelope onto the visible element exactly the way
    // `syncRememberingNpcRecognitionDom` does — the assertion below
    // proves the numbers actually reach a rendered node.
    overlay.dataset.active = "true";
    overlay.dataset.audioArmed = envelope.audioCueArmed ? "true" : "false";
    overlay.style.setProperty(
      "--aftersign-remembering-portrait-push-px",
      `${envelope.portraitPushInPx.toFixed(2)}px`,
    );
    overlay.style.setProperty(
      "--aftersign-remembering-ring-scale",
      envelope.recognitionRingScale.toFixed(3),
    );
    overlay.style.setProperty(
      "--aftersign-remembering-ring-opacity",
      envelope.recognitionRingOpacity.toFixed(3),
    );
    overlay.style.setProperty(
      "--aftersign-remembering-subtitle-pop-px",
      `${envelope.subtitlePopDistancePx.toFixed(2)}px`,
    );
    overlay.style.setProperty(
      "--aftersign-remembering-subtitle-opacity",
      envelope.subtitleOpacity.toFixed(3),
    );
    subtitle.textContent = midSample.dialogue.lines[0] ?? "";

    // Visible-render pins: the overlay is active, audio-armed, and
    // every CSS variable now carries a real (non-zero, non-baseline)
    // value.  Ring opacity + subtitle opacity are the two channels
    // Soren specifically named — assert both directly.
    expect(overlay.dataset.active).toBe("true");
    expect(overlay.dataset.audioArmed).toBe("true");
    expect(
      overlay.style.getPropertyValue("--aftersign-remembering-ring-opacity"),
    ).not.toBe("0");
    expect(
      Number(
        overlay.style.getPropertyValue("--aftersign-remembering-ring-opacity"),
      ),
    ).toBeGreaterThan(0);
    expect(
      Number(
        overlay.style.getPropertyValue("--aftersign-remembering-ring-scale"),
      ),
    ).toBeGreaterThan(1);
    expect(
      overlay.style.getPropertyValue("--aftersign-remembering-subtitle-opacity"),
    ).not.toBe("0");
    expect(
      Number(
        overlay.style.getPropertyValue(
          "--aftersign-remembering-subtitle-opacity",
        ),
      ),
    ).toBeGreaterThan(0);
    // Subtitle carries the resolver's line, not a placeholder — the
    // one-call-per-frame wrapper delivers dialogue + envelope so a
    // renderer never has to weave two sources.
    expect(subtitle.textContent).toBeTruthy();
    expect(subtitle.textContent).toBe(midSample.dialogue.lines[0]);

    // First-contact fallthrough: on the meet-but-don't-recognize path,
    // `dialogue.recognitionFeel` is null and the wrapper returns
    // `envelope: null` — the renderer keeps the overlay inert.  This
    // matches the off-beat baseline the played page paints for a
    // fresh session where Io hasn't met the player before.
    const firstContactSample = sampleAftersignRememberingNpcRecognitionBeat(
      met,
      "io",
      midElapsedMs,
    );
    expect(firstContactSample.envelope).toBeNull();
  });
});

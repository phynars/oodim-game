// Served-surface PLAYED spec for Saint Orra's first-name dialogue.
//
// The sibling module (`orraFirstNameDialogue.ts`) exports a frozen
// data contract + a pure `resolveOrraFirstNameDialogue` resolver +
// a DOM writer `renderOrraFirstNameDialogue(document, choiceId)`
// that stamps `#speaker` / `#line` on the served page.
//
// The reviewer on PR #1331 (correctly) flagged that a frozen
// dialogue contract with no consumer is dead code with green tests.
// This spec closes that gap by loading the REAL served `aftersign/
// index.html`, parsing it into a JSDOM, and driving the writer
// against the actual served `#speaker` / `#line` nodes for every
// one of the three player choices. `servedSurface.contract.test.ts`
// grep-pins that `aftersign/main.js` imports the writer and exposes
// `window.__game.renderOrraFirstNameDialogue`; THIS spec pins that
// the DOM the writer receives from main.js is shaped correctly and
// that each choice produces a distinguishable, player-visible beat.
//
// Scope guard (same pattern as `tapConfirmFeel.servedButton.test.ts`):
//   - Does NOT boot `aftersign/main.js` (that pulls in THREE.js and
//     the whole scene graph — out of scope for a unit test).
//   - The `main.js` import + seam wiring is asserted by the sibling
//     grep-level `servedSurface.contract.test.ts`.
//   - THIS file asserts what a phone tap on the beat would produce:
//     Orra's voice lands in `#line`, the speaker flips to "Saint
//     Orra", each choice's player + Orra reply lines are visible,
//     and the beat/choice attributes carry the ids a tap harness
//     needs to locate the beat.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ORRA_FIRST_NAME_DIALOGUE,
  renderOrraFirstNameDialogue,
  resolveOrraFirstNameDialogue,
  type OrraFirstNameChoiceId,
} from "./orraFirstNameDialogue";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const CHOICE_IDS: ReadonlyArray<OrraFirstNameChoiceId> = [
  "acceptWithoutAsking",
  "askWhoItHurts",
  "refuse",
];

describe("orraFirstNameDialogue served-surface spec (drives the rendered aftersign/index.html)", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
  });

  afterEach(() => {
    dom.window.close();
  });

  it("finds the served speaker + line nodes the writer needs", () => {
    // Baseline: the shipped page renders `#speaker` and `#line` as
    // the sole per-beat voice slot. If either disappears (rename,
    // restructure), every writer that stamps a beat reds — this
    // spec fires first so the failure points at the DOM contract,
    // not at Orra's beat specifically.
    const doc = dom.window.document;
    const speakerNode = doc.querySelector("#speaker");
    const lineNode = doc.querySelector("#line");
    expect(speakerNode, "served page must render a #speaker node")
      .not.toBeNull();
    expect(lineNode, "served page must render a #line node").not.toBeNull();
    expect(speakerNode?.tagName.toLowerCase()).toBe("p");
    expect(lineNode?.tagName.toLowerCase()).toBe("p");
  });

  for (const choiceId of CHOICE_IDS) {
    it(`stamps Orra's voice + beat/choice attributes for choice "${choiceId}"`, () => {
      const doc = dom.window.document;
      const speakerNode = doc.querySelector("#speaker") as HTMLElement;
      const lineNode = doc.querySelector("#line") as HTMLElement;

      // Sanity: neither node carries an Orra beat id before the
      // writer runs — this is the shipped index.html's cold state.
      expect(lineNode.getAttribute("data-beat-id")).toBeNull();
      expect(lineNode.getAttribute("data-choice-id")).toBeNull();

      const resolved = renderOrraFirstNameDialogue(doc, choiceId);

      // The resolver's beat id is the same beat id the writer
      // stamps — one axis, no drift between "what the beat is
      // called" and "what a tap harness sees."
      expect(resolved.beatId).toBe(ORRA_FIRST_NAME_DIALOGUE.id);
      expect(resolved.speaker).toBe(ORRA_FIRST_NAME_DIALOGUE.speaker);

      // Speaker flips to Saint Orra and carries the beat id — a
      // harness that queries `[data-beat-id="orra-first-name"]`
      // finds both the speaker AND line paragraphs, so it can
      // read either without a second selector.
      expect(speakerNode.textContent).toBe("Saint Orra");
      expect(speakerNode.getAttribute("data-beat-id")).toBe(
        "orra-first-name",
      );

      // `#line` is stamped with the beat id AND the external
      // choice id (kebab-case — the vocabulary the rest of the
      // served page uses via `data-aftersign-tap-choice`, so a
      // tap harness picks Orra's beat with the same idiom it
      // picks the packet/route/deliver forks).
      expect(lineNode.getAttribute("data-beat-id")).toBe("orra-first-name");
      const externalChoiceId =
        ORRA_FIRST_NAME_DIALOGUE.choices[choiceId].id;
      expect(lineNode.getAttribute("data-choice-id")).toBe(externalChoiceId);

      // Player-visible copy pin: the player and Orra replies for
      // THIS choice must land in `#line`, and the entry/offer/route
      // frames must land alongside them so the beat reads as one
      // paragraph. A future refactor that drops any of the four
      // reds this pin.
      const rendered = lineNode.textContent ?? "";
      expect(rendered).toContain(ORRA_FIRST_NAME_DIALOGUE.entryLines[0]);
      expect(rendered).toContain(ORRA_FIRST_NAME_DIALOGUE.offerLines[0]);
      expect(rendered).toContain(
        ORRA_FIRST_NAME_DIALOGUE.choices[choiceId].playerLine,
      );
      expect(rendered).toContain(
        ORRA_FIRST_NAME_DIALOGUE.choices[choiceId].orraLine,
      );
      expect(rendered).toContain(ORRA_FIRST_NAME_DIALOGUE.routeHintLines[0]);

      // The resolver's `remembered` sentence — the durable-memory
      // face of the choice — matches the module's memorySentences
      // table for THIS choice. This is what a memory-persistence
      // lane would carry forward, so the spec pins it here even
      // though the writer only speaks it (no DOM stamp yet).
      expect(resolved.remembered).toBe(
        ORRA_FIRST_NAME_DIALOGUE.memorySentences[choiceId],
      );
    });
  }

  it("distinguishes the three choices by the player + Orra replies they carry", () => {
    // Cross-choice pin: rendering the SAME beat with a different
    // choice must produce a distinguishable player-visible line.
    // A refactor that (say) collapsed all three choices to the
    // same reply, or shared a single string across two of them,
    // reds here.
    const renderedForEachChoice = CHOICE_IDS.map((choiceId) => {
      const localDom = new JSDOM(readServedIndexHtml());
      const doc = localDom.window.document;
      renderOrraFirstNameDialogue(doc, choiceId);
      const rendered = doc.querySelector("#line")?.textContent ?? "";
      localDom.window.close();
      return { choiceId, rendered };
    });

    for (let i = 0; i < renderedForEachChoice.length; i += 1) {
      for (let j = i + 1; j < renderedForEachChoice.length; j += 1) {
        const a = renderedForEachChoice[i];
        const b = renderedForEachChoice[j];
        expect(
          a.rendered,
          `rendered #line for "${a.choiceId}" must differ from "${b.choiceId}"`,
        ).not.toBe(b.rendered);
      }
    }
  });

  it("throws with a specific error when a caller reaches the beat with an unknown choice", () => {
    // The resolver is the STATE half of the contract; the writer
    // delegates to it. A garbled caller (typo, stale save) should
    // fail loudly at the boundary, not silently render an empty
    // beat — an empty `#line` post-tap would look like a bug in
    // the render loop, not in the caller.
    const doc = dom.window.document;
    expect(() =>
      renderOrraFirstNameDialogue(
        doc,
        "unknown-choice" as unknown as OrraFirstNameChoiceId,
      ),
    ).toThrow(/Unknown Orra first-name choice: unknown-choice/);

    // And the pure resolver rejects the same shape identically —
    // the two entry points cannot drift.
    expect(() =>
      resolveOrraFirstNameDialogue(
        "another-unknown" as unknown as OrraFirstNameChoiceId,
      ),
    ).toThrow(/Unknown Orra first-name choice: another-unknown/);
  });
});

// #2158 (M2): Io's packet-offered line names what she remembers and the jobs
// it unlocked, using the SAME offer derivation the tray renders.
import { describe, expect, it } from "vitest";
import { ioOfferLineFor, speakOfferLabels } from "../../../../aftersign/src/ioOfferMemoryLine.js";
import { IO_DEFAULT_OFFER_LINE } from "../../../../aftersign/src/ioDefaultOfferCopy.js";
import { offeredJobsMemoryFromIoMemory } from "../../../../aftersign/src/offeredJobsMemoryFromIoMemory.js";
import { selectIoJobOffers } from "../../../../packages/aftersign/src/computeOfferedJobs";

const fact = (object: string) => ({ kind: "delivery-outcome", subject: "io", object });
const lineFor = (memory: Array<{ kind: string; object: string }>, reason?: string | null) =>
  ioOfferLineFor(memory, selectIoJobOffers(offeredJobsMemoryFromIoMemory(memory)), reason);

describe("ioOfferLineFor", () => {
  it("fresh save: the unchanged default line, even with a stray tone", () => {
    expect(lineFor([])).toBe(IO_DEFAULT_OFFER_LINE);
    expect(lineFor([], "blunt")).toBe(IO_DEFAULT_OFFER_LINE);
    expect(ioOfferLineFor(null, selectIoJobOffers(undefined), null)).toBe(IO_DEFAULT_OFFER_LINE);
  });

  it("sealed delivery remembered: names the memory and the unlocked jobs by their tray labels", () => {
    const line = lineFor([fact("sealed")]);
    expect(line).not.toBe(IO_DEFAULT_OFFER_LINE);
    expect(line).toContain("blue seal back unbroken");
    for (const offer of selectIoJobOffers({ priorOutcome: "completed" })) expect(line).toContain(offer.label);
  });

  it("the player's return tone is remembered too, so the next round's line changes", () => {
    const before = lineFor([fact("sealed")]);
    for (const [reason, words] of [["kind", "gentle"], ["evasive", "dodged"], ["blunt", "told me straight"]]) {
      const after = lineFor([fact("sealed")], reason);
      expect(after).not.toBe(before);
      expect(after).toContain(words);
      expect(after.startsWith(before)).toBe(true);
    }
    expect(lineFor([fact("sealed")], "unknown-token")).toBe(before);
  });

  it("opened packet remembered: names the debt and the repair job", () => {
    const line = lineFor([fact("opened")]);
    expect(line).toContain("You opened the last packet");
    expect(line).toContain("Wax-debt repair run");
  });

  it("speaks labels as a list", () => {
    expect(speakOfferLabels([{ label: "A" }])).toBe("A");
    expect(speakOfferLabels([{ label: "A" }, { label: "B" }])).toBe("A or B");
    expect(speakOfferLabels([{ label: "A" }, { label: "B" }, { label: "C" }])).toBe("A, B or C");
    expect(speakOfferLabels([])).toBe("");
  });
});

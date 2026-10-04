// Io's line at `packet-offered`, chosen by what she remembers (#2158, M2).
//
// Before this module, the offer beat always spoke IO_DEFAULT_OFFER_LINE, so
// the memory payback was mechanical only: a returning courier saw different
// job buttons under an identical line, and round 2 repeated round 1 word for
// word. M2's DONE bar is a stranger answering "what will you do differently
// next round?" — the words have to point at the change.
//
// Two durable memories speak here:
//   1. the delivery outcome Io remembers (sealed / opened) and the jobs it
//      unlocked — named by the SAME offers the #offeredJobs tray renders
//      (offeredJobsMemoryFromIoMemory → selectIoJobOffers), so voice and
//      buttons come from one derivation;
//   2. how the player answered Io when they came back (state.player.
//      returnReason: kind / evasive / blunt), once there is one.
// No delivery memory → the unchanged default line.
import { IO_DEFAULT_OFFER_LINE } from "./ioDefaultOfferCopy.js";
import {
  NPC_MEMORY_FACT_KIND,
  NPC_MEMORY_OBJECT,
} from "./npcMemoryFlagSchema.js";

const remembers = (memory, object) =>
  Array.isArray(memory)
  && memory.some((fact) => fact && fact.kind === NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME && fact.object === object);

const RETURN_TONE_CLAUSE = Object.freeze({
  kind: "And you came back gentle with me last time. I haven't forgotten.",
  evasive: "And last time you dodged my question. I noticed.",
  blunt: "And last time you told me straight. I respect that more than you'd think.",
});

/** "A", "A or B", "A, B or C" — the tray's button labels, as spoken. */
export function speakOfferLabels(offers) {
  const labels = (offers ?? []).map((offer) => offer?.label).filter(Boolean);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/**
 * @param {Array<{ kind?: string, object?: string }> | null | undefined} ioMemory
 * @param {Array<{ label: string }>} offers  the offers the tray renders
 * @param {string | null} [returnReason]  kind / evasive / blunt
 * @returns {string}
 */
export function ioOfferLineFor(ioMemory, offers, returnReason) {
  const jobs = speakOfferLabels(offers);
  const sealed = remembers(ioMemory, NPC_MEMORY_OBJECT.PACKET_SEALED);
  const opened = remembers(ioMemory, NPC_MEMORY_OBJECT.PACKET_OPENED);
  if (!jobs || (!sealed && !opened)) return IO_DEFAULT_OFFER_LINE;

  const base = sealed
    ? `You brought my blue seal back unbroken. That's why the board shows ${jobs} now: work I don't give strangers. Pick one.`
    : `You opened the last packet, and the city counts that as a debt. Until it's paid, the work is ${jobs}. Carry it sealed and better routes come back.`;
  const tone = returnReason ? RETURN_TONE_CLAUSE[returnReason] : undefined;
  return tone ? `${base} ${tone}` : base;
}

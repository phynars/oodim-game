// Pure memory → offered ACTION SET map (M-LOOP-E1 impl story, #1371).
//
// The rule for M-LOOP is DIVERGENCE: two saves with different memory
// records must expose different TAPPABLE elements on the served page,
// not just different lines. This module is the single source of truth
// for that mapping — a pure function of the persisted memory record,
// unit-tested in isolation, and consumed by both the vitest surface
// (`windowGameSurface.ts`) and the served renderer (`aftersign/main.js`,
// wired via `window.__game.offeredActions`).
//
// The mapping keys on THREE axes the memory record already carries so
// two divergent saves produce two divergent tappable sets:
//   1. `orraAction`      — if the previous round mints an "answered
//                          Saint Orra" fact, THAT job replaces the
//                          packet job entirely (a wholly different
//                          action, not a re-labeled one).
//   2. `packetOutcome`   — the packet's sealed-vs-opened outcome
//                          picks which of the two carry-forward jobs
//                          Io offers.
//   3. `returnTone`      — the posture the player struck at
//                          `io-return-recognition` shades the SAME
//                          job with a warm/plain/cold variant so a
//                          save that differs ONLY in tone still
//                          exposes a distinct action id (this is what
//                          keeps the divergence gate #1370 green when
//                          the packet outcome is held constant).
//
// The returned action ids are the divergence axis: the renderer stamps
// them onto `data-offered-action` on the tappable DOM elements it
// creates, so a Playwright spec can assert element-level divergence
// (a button with id X present in run A, absent in run B) without
// reading any line text.

export type AftersignReturnTone = "warm" | "plain" | "cold";

export type AftersignMemoryRecord = {
  readonly returnTone?: AftersignReturnTone;
  readonly packetOutcome: "opened" | "sealed" | null;
  readonly orraAction: "answered-saint-orra" | null;
};

export type AftersignOfferedActionId =
  | "carry-opened-packet"
  | "carry-opened-packet-warm"
  | "carry-opened-packet-cold"
  | "carry-sealed-packet"
  | "carry-sealed-packet-warm"
  | "carry-sealed-packet-cold"
  | "answer-for-orra"
  | "answer-for-orra-warm"
  | "answer-for-orra-cold";

export type AftersignOfferedAction = {
  readonly id: AftersignOfferedActionId;
  readonly label: string;
};

// Tone axis names the action id + suffixes the label. "plain" (or
// missing / unrecognized) is the neutral base — no suffix — so an
// existing save that never struck a return tone keeps the current
// action ids and doesn't regress the served page's element inventory.
const toneSuffixForId = (tone: AftersignReturnTone | undefined): "" | "-warm" | "-cold" => {
  if (tone === "warm") return "-warm";
  if (tone === "cold") return "-cold";
  return "";
};

const toneLabel = (tone: AftersignReturnTone | undefined): string => {
  if (tone === "warm") return " (warm return)";
  if (tone === "cold") return " (cold return)";
  return "";
};

/**
 * The job board is deliberately a pure reading of the saved choices.
 * A renderer receives only these actions, so it has no non-offered action
 * available to place in the DOM.
 */
export function computeOfferedActions(
  memoryRecord: AftersignMemoryRecord,
): readonly AftersignOfferedAction[] {
  const toneSuffix = toneSuffixForId(memoryRecord.returnTone);
  const toneCopy = toneLabel(memoryRecord.returnTone);

  if (memoryRecord.orraAction === "answered-saint-orra") {
    return [
      {
        id: `answer-for-orra${toneSuffix}` as AftersignOfferedActionId,
        label: `Carry a reply for Orra${toneCopy}`,
      },
    ];
  }
  if (memoryRecord.packetOutcome === "opened") {
    return [
      {
        id: `carry-opened-packet${toneSuffix}` as AftersignOfferedActionId,
        label: `Carry what was opened${toneCopy}`,
      },
    ];
  }
  return [
    {
      id: `carry-sealed-packet${toneSuffix}` as AftersignOfferedActionId,
      label: `Carry what stayed sealed${toneCopy}`,
    },
  ];
}

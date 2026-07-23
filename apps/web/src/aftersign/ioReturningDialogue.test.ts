import {
  chooseAftersignIoReturningLine,
  listAftersignIoReturningLines,
  type AftersignIoReturningLine,
} from "./ioReturningDialogue";

function expectLine(
  line: AftersignIoReturningLine,
  expected: AftersignIoReturningLine,
): void {
  expect(line.id).toBe(expected.id);
  expect(line.text).toBe(expected.text);
  expect(line.references).toEqual(expected.references);
}

describe("AFTERSIGN Io returning dialogue", () => {
  it("pins the sealed-packet return line to the exact remembered action", () => {
    expectLine(
      chooseAftersignIoReturningLine({
        returnedAfterClose: true,
        packetOutcome: "sealed",
      }),
      {
        id: "io-returned-seal-unbroken",
        text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
        references: ["return:after-close", "packet:sealed"],
      },
    );
  });

  it("pins the opened-packet return line to the exact remembered action", () => {
    expectLine(
      chooseAftersignIoReturningLine({
        returnedAfterClose: true,
        packetOutcome: "opened",
      }),
      {
        id: "io-returned-seal-broken",
        text: "You came back. The seal did not. I can use one of those facts.",
        references: ["return:after-close", "packet:opened"],
      },
    );
  });

  it("keeps non-core packet outcomes authored and auditable", () => {
    expectLine(
      chooseAftersignIoReturningLine({ packetOutcome: "withheld" }),
      {
        id: "io-returned-packet-withheld",
        text: "You kept the packet. Not theft, not delivery. A third column in a bad ledger.",
        references: ["packet:withheld"],
      },
    );

    expectLine(
      chooseAftersignIoReturningLine({ packetOutcome: "returned" }),
      {
        id: "io-returned-packet-returned",
        text: "You brought it back instead of guessing. That saves more lives than speed does.",
        references: ["packet:returned"],
      },
    );
  });

  it("can select route-attention lines when no packet outcome dominates", () => {
    expectLine(
      chooseAftersignIoReturningLine({ routeAttention: "skipped" }),
      {
        id: "io-returned-route-skipped",
        text: "You found the box anyway. Next time, let me finish saving your life.",
        references: ["route:skipped"],
      },
    );

    expectLine(
      chooseAftersignIoReturningLine({ routeAttention: "listened" }),
      {
        id: "io-returned-route-listened",
        text: "You listened before you ran. Rare habit. Keep it.",
        references: ["route:listened"],
      },
    );
  });

  it("can select return-reason lines when no stronger memory exists", () => {
    expectLine(
      chooseAftersignIoReturningLine({ returnReason: "kind" }),
      {
        id: "io-returned-reason-kind",
        text: "You came back kind. Useful, if you keep it sharper than pity.",
        references: ["reason:kind"],
      },
    );

    expectLine(
      chooseAftersignIoReturningLine({ returnReason: "evasive" }),
      {
        id: "io-returned-reason-evasive",
        text: "You came back with half an answer. I can work with half. I charge extra for it.",
        references: ["reason:evasive"],
      },
    );

    expectLine(
      chooseAftersignIoReturningLine({ returnReason: "blunt" }),
      {
        id: "io-returned-reason-blunt",
        text: "You came back blunt. Good. The city lies enough for both of us.",
        references: ["reason:blunt"],
      },
    );
  });

  it("falls back without inventing a remembered action", () => {
    expectLine(chooseAftersignIoReturningLine({}), {
      id: "io-returned-fallback",
      text: "Back again. Good. Vey wastes plenty. I try not to waste returns.",
      references: [],
    });
  });

  it("keeps every authored line tied to only the memory references it speaks from", () => {
    expect(listAftersignIoReturningLines()).toEqual([
      {
        id: "io-returned-seal-unbroken",
        text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
        references: ["return:after-close", "packet:sealed"],
      },
      {
        id: "io-returned-seal-broken",
        text: "You came back. The seal did not. I can use one of those facts.",
        references: ["return:after-close", "packet:opened"],
      },
      {
        id: "io-returned-packet-withheld",
        text: "You kept the packet. Not theft, not delivery. A third column in a bad ledger.",
        references: ["packet:withheld"],
      },
      {
        id: "io-returned-packet-returned",
        text: "You brought it back instead of guessing. That saves more lives than speed does.",
        references: ["packet:returned"],
      },
      {
        id: "io-returned-route-skipped",
        text: "You found the box anyway. Next time, let me finish saving your life.",
        references: ["route:skipped"],
      },
      {
        id: "io-returned-route-listened",
        text: "You listened before you ran. Rare habit. Keep it.",
        references: ["route:listened"],
      },
      {
        id: "io-returned-reason-kind",
        text: "You came back kind. Useful, if you keep it sharper than pity.",
        references: ["reason:kind"],
      },
      {
        id: "io-returned-reason-evasive",
        text: "You came back with half an answer. I can work with half. I charge extra for it.",
        references: ["reason:evasive"],
      },
      {
        id: "io-returned-reason-blunt",
        text: "You came back blunt. Good. The city lies enough for both of us.",
        references: ["reason:blunt"],
      },
      {
        id: "io-returned-fallback",
        text: "Back again. Good. Vey wastes plenty. I try not to waste returns.",
        references: [],
      },
    ]);
  });
});

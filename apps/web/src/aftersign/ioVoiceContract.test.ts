import {
  getAftersignIoPrimaryReturnLine,
  getAftersignIoRecognitionLines,
} from "./ioVoiceContract";

describe("Aftersign Io voice contract", () => {
  it("remembers a returned sealed packet with ledger-calm specificity", () => {
    expect(
      getAftersignIoPrimaryReturnLine({
        packetOutcome: "sealed",
        returnedAfterLeaving: true,
        listenedToRoute: true,
      }),
    ).toEqual({
      id: "io-return-packet-sealed",
      text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      remembers: ["returned-after-leaving", "packet-sealed"],
    });
  });

  it("remembers an opened packet without pretending trust is unchanged", () => {
    expect(
      getAftersignIoPrimaryReturnLine({
        packetOutcome: "opened",
        returnedAfterLeaving: true,
        listenedToRoute: true,
      }),
    ).toEqual({
      id: "io-return-packet-opened",
      text: "You came back. The seal did not. I can use one of those facts.",
      remembers: ["returned-after-leaving", "packet-opened"],
    });
  });

  it("keeps route-memory lines tied to the concrete route behavior", () => {
    expect(
      getAftersignIoRecognitionLines({
        packetOutcome: "sealed",
        returnedAfterLeaving: false,
        listenedToRoute: false,
      }),
    ).toEqual([
      {
        id: "io-route-skipped",
        text: "You found the box anyway. Next time, let me finish saving your life.",
        remembers: ["skipped-route"],
      },
    ]);
  });

  it("adds return-posture texture only after the required memory beat", () => {
    expect(
      getAftersignIoRecognitionLines({
        packetOutcome: "sealed",
        returnedAfterLeaving: true,
        listenedToRoute: true,
        returnPosture: "evasive",
      }),
    ).toEqual([
      {
        id: "io-return-packet-sealed",
        text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
        remembers: ["returned-after-leaving", "packet-sealed"],
      },
      {
        id: "io-route-listened",
        text: "You listened before you ran. Rare habit. Keep it.",
        remembers: ["listened-to-route"],
      },
      {
        id: "io-return-evasive",
        text: "You walked around the question. I mark detours too.",
        remembers: ["returned-evasive"],
      },
    ]);
  });
});

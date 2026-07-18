import {
  createAftersignVerticalSliceState,
  recordAftersignPacketChoice,
} from "./verticalSliceState";

describe("Aftersign packet intent contract", () => {
  it("records opening and preserving the blue packet as distinct deliberate actions", () => {
    const sealedState = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const openedState = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );

    const sealedSnapshot = JSON.stringify(sealedState);
    const openedSnapshot = JSON.stringify(openedState);

    expect(sealedSnapshot).not.toEqual(openedSnapshot);
    expect(sealedSnapshot).toMatch(/sealed|unbroken/i);
    expect(openedSnapshot).toMatch(/opened|broken/i);
  });

  it("makes the packet outcome inspectable by the harness before Io remembers it", () => {
    const sealedState = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );

    const harnessSnapshot = JSON.stringify(sealedState);

    expect(harnessSnapshot).toMatch(/packet/i);
    expect(harnessSnapshot).toMatch(/sealed|unbroken/i);
  });
});

import { describe, expect, it } from "vitest";
import { resolveIoFinalDialogue } from "./ioFinalDialogue.js";

describe("resolveIoFinalDialogue", () => {
  it.each([
    [true, "keep-official-record", "io-final-sealed-official", "kept the seal"],
    [true, "protect-private-lie", "io-final-sealed-private", "protected the private lie"],
    [true, "hang-new-sign", "io-final-sealed-sign", "hung a new sign"],
    [false, "keep-official-record", "io-final-opened-official", "broke the seal"],
    [false, "protect-private-lie", "io-final-opened-private", "broke the seal"],
    [false, "hang-new-sign", "io-final-opened-sign", "broke the seal"],
  ])("selects %s/%s without inventing an action", (packetSealed, doorChoice, id, action) => {
    expect(resolveIoFinalDialogue({ packetSealed, doorChoice })).toMatchObject({ id });
    expect(resolveIoFinalDialogue({ packetSealed, doorChoice }).text).toContain(action);
  });

  it("makes each seal record distinct for the same door action", () => {
    for (const doorChoice of ["keep-official-record", "protect-private-lie", "hang-new-sign"]) {
      expect(resolveIoFinalDialogue({ packetSealed: true, doorChoice })).not.toEqual(
        resolveIoFinalDialogue({ packetSealed: false, doorChoice }),
      );
    }
  });

  it("does not speak before a valid visible door action", () => {
    expect(resolveIoFinalDialogue({ packetSealed: true, doorChoice: null })).toBeNull();
  });

  it("does not guess a seal when the first packet's seal is unknown", () => {
    expect(resolveIoFinalDialogue({ packetSealed: null, doorChoice: "protect-private-lie" })).toBeNull();
    expect(resolveIoFinalDialogue({ packetSealed: undefined, doorChoice: "hang-new-sign" })).toBeNull();
  });
});

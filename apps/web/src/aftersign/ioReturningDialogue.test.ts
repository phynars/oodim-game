import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RETURNING_LINES,
  chooseAftersignIoReturningLine,
} from "./ioReturningDialogue";

describe("chooseAftersignIoReturningLine", () => {
  it("returns Io's sealed-packet memory line with auditable references", () => {
    expect(
      chooseAftersignIoReturningLine({
        packetOutcome: "sealed",
        returnedAfterClose: true,
        routeAttention: "skipped",
      }),
    ).toEqual(AFTERSIGN_IO_RETURNING_LINES.packetSealed);
  });

  it("returns Io's opened-packet memory line with auditable references", () => {
    expect(
      chooseAftersignIoReturningLine({
        packetOutcome: "opened",
        returnedAfterClose: true,
        routeAttention: "listened",
      }),
    ).toEqual(AFTERSIGN_IO_RETURNING_LINES.packetOpened);
  });

  it("falls back to route attention only when packet outcome is not known", () => {
    expect(
      chooseAftersignIoReturningLine({ routeAttention: "skipped" }),
    ).toEqual(AFTERSIGN_IO_RETURNING_LINES.routeSkipped);

    expect(
      chooseAftersignIoReturningLine({ routeAttention: "listened" }),
    ).toEqual(AFTERSIGN_IO_RETURNING_LINES.routeListened);
  });

  it("does not invent a memory when nothing auditable is present", () => {
    expect(chooseAftersignIoReturningLine({})).toEqual(
      AFTERSIGN_IO_RETURNING_LINES.fallback,
    );
    expect(chooseAftersignIoReturningLine({}).references).toEqual([]);
  });
});

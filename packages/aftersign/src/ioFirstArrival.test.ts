import { getIoFirstArrivalLine, IO_FIRST_ARRIVAL_LINES } from "./ioFirstArrival";

describe("Io first-arrival dialogue", () => {
  it("pins the opening beat to the Night Post arrival", () => {
    expect(getIoFirstArrivalLine("opening")).toBe(
      "You found the Night Post. Or it found the shape of you. Either way, stand where the roof still works."
    );
  });

  it("makes the sealed packet instruction concrete and auditable", () => {
    expect(getIoFirstArrivalLine("packetOffer")).toBe(
      "Blue seal. Dry as I can keep it. Take it to the sign box before the stair changes its mind."
    );
    expect(getIoFirstArrivalLine("packetWarning")).toBe(
      "Do not open it unless you want the message to remember your hands first."
    );
  });

  it("keeps the route instruction readable as play text", () => {
    expect(getIoFirstArrivalLine("routeStart")).toBe(
      "Three lanterns down. Brass moth left. Red string up. If the water is above your ankles, you chose the wrong stair."
    );
  });

  it("pins inspect lines to objects in Io's kiosk", () => {
    expect(IO_FIRST_ARRIVAL_LINES.inspectKettle).toBe(
      "Kettle is for morale. Tea is for districts with budgets."
    );
    expect(IO_FIRST_ARRIVAL_LINES.inspectLedger).toBe(
      "Names in black arrived. Names in red arrived late. Names in pencil are pretending."
    );
  });

  it("distinguishes sealed and opened packet returns before persistence", () => {
    expect(getIoFirstArrivalLine("sealedReturn")).toBe(
      "Seal intact. Good. The city likes a courier who knows the difference between carrying and owning."
    );
    expect(getIoFirstArrivalLine("openedReturn")).toBe(
      "Seal broken. Useful information, badly purchased."
    );
  });
});

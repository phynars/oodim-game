import {
  ORRA_RECOGNITION_BEATS,
  selectOrraRecognitionBeat,
} from "./orra-recognition-beat";

describe("Orra recognition beat", () => {
  it("does not claim memory before Orra has met the courier", () => {
    expect(selectOrraRecognitionBeat({ hasMetOrra: false })).toEqual(
      ORRA_RECOGNITION_BEATS.firstMeeting,
    );
  });

  it("recognizes the remembered signal choice", () => {
    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "taken",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.signal.taken);

    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "left",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.signal.left);
  });

  it("recognizes the remembered pace before falling back to signal", () => {
    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "taken",
        pace: "waited",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.pace.waited);

    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "left",
        pace: "rushed",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.pace.rushed);
  });

  it("prioritizes debt memory as Orra's sharpest return beat", () => {
    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "taken",
        pace: "waited",
        debt: "named",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.debt.named);

    expect(
      selectOrraRecognitionBeat({
        hasMetOrra: true,
        signal: "left",
        pace: "rushed",
        debt: "refused",
      }),
    ).toEqual(ORRA_RECOGNITION_BEATS.debt.refused);
  });

  it("keeps every returning beat tied to explicit server facts", () => {
    const returningBeats = [
      ...Object.values(ORRA_RECOGNITION_BEATS.signal),
      ...Object.values(ORRA_RECOGNITION_BEATS.pace),
      ...Object.values(ORRA_RECOGNITION_BEATS.debt),
    ];

    for (const beat of returningBeats) {
      expect(beat.rememberedFacts).toContain("orra.met");
      expect(beat.rememberedFacts.length).toBeGreaterThan(1);
      expect(beat.id).toMatch(/^orra-/);
      expect(beat.text.length).toBeGreaterThan(20);
    }
  });
});

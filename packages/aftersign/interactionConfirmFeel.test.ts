import {
  assertInteractionConfirmFeelContract,
  interactionConfirmFeel,
} from "./interactionConfirmFeel";

function test(name: string, run: () => void): void {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("interaction confirm feel keeps its 180ms bounce contract", () => {
  assertInteractionConfirmFeelContract(interactionConfirmFeel);
});

test("interaction confirm has press, hold, commit, and settle keyframes", () => {
  const frames = interactionConfirmFeel.keyframes;

  if (frames.length !== 4) {
    throw new Error(`expected 4 keyframes, got ${frames.length}`);
  }

  const [press, hold, commit, settle] = frames;

  if (press.stage !== "press" || press.atMs !== 0 || press.scale !== 0.94) {
    throw new Error(`press keyframe drifted: ${JSON.stringify(press)}`);
  }

  if (hold.stage !== "hold" || hold.atMs !== 48 || hold.liftPx !== 2) {
    throw new Error(`hold keyframe drifted: ${JSON.stringify(hold)}`);
  }

  if (
    commit.stage !== "commit" ||
    commit.atMs !== 96 ||
    commit.scale !== 1.035 ||
    commit.liftPx !== 6 ||
    commit.glowAlpha !== 0.72 ||
    commit.sound !== "confirm-chime"
  ) {
    throw new Error(`commit keyframe drifted: ${JSON.stringify(commit)}`);
  }

  if (settle.stage !== "settle" || settle.atMs !== 180 || settle.scale !== 1) {
    throw new Error(`settle keyframe drifted: ${JSON.stringify(settle)}`);
  }
});

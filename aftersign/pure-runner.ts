import { runPacketIntentChecks } from "./src/packetIntent.test.ts";
import { runRecognitionBeatChecks } from "./src/recognitionBeat.test.ts";
import { runIoRecognitionCueContractChecks } from "./src/ioRecognitionCueContract.test.ts";
import { runMemoryPromptTimingChecks } from "./src/feel/memoryPromptTiming.ts";
import { runFirstCameraMoveChecks } from "./src/feel/firstCameraMove.test.ts";

type Runner = {
  label: string;
  run: () => void;
};

const runners: Runner[] = [
  { label: "packet-intent", run: runPacketIntentChecks },
  { label: "recognition-beat", run: runRecognitionBeatChecks },
  { label: "io-recognition-cue", run: runIoRecognitionCueContractChecks },
  { label: "memory-prompt-timing-feel", run: () => runMemoryPromptTimingChecks() },
  { label: "first-camera-move", run: runFirstCameraMoveChecks },
];

for (const runner of runners) {
  try {
    runner.run();
    console.log(`✅ ${runner.label}`);
  } catch (error) {
    console.error(`❌ ${runner.label}`);
    throw error;
  }
}

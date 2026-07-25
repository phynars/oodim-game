// Explicit `.ts` extension: Node's --experimental-strip-types (used by the
// `test:aftersign:pure` script) requires exact file paths on relative
// imports. `moduleResolution: "Bundler"` in aftersign/tsconfig.json accepts
// the `.ts` suffix during typecheck, so both lanes agree.
import { runPacketIntentChecks } from "./packetIntent.ts";

runPacketIntentChecks();

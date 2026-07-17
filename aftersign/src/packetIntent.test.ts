// Plain-TS assertion runner for the packet intent contract — NOT a vitest
// suite (vitest is not a repo dependency; see aftersign/README.md
// "Test harness convention"). Import this module's side effect, or call
// `runPacketIntentChecks()` from the harness entry, to execute the checks.
import { runPacketIntentChecks } from './packetIntent';

runPacketIntentChecks();

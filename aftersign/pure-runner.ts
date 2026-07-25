import { runPacketIntentChecks } from "./src/packetIntent";

async function main(): Promise<void> {
  runPacketIntentChecks();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

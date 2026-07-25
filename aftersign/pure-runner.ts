import { runPacketIntentChecks } from "./src/packet-intent-contract.test";

async function main(): Promise<void> {
  await runPacketIntentChecks();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

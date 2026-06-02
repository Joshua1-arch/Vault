import { createPublicClient, http } from "viem";
import { cdrAbi } from "@piplabs/cdr-contracts";

async function main() {
  const pc = createPublicClient({
    transport: http("http://127.0.0.1:8545"),
  });

  const uuid = 4892;
  const accessAuxData = "0x";
  const requesterPubKey = "0x0404de86f0f5d7442443264dfce2f478ec338e2daaa0f8e756d88007c88db81ece7f25e12b2c5fabbb30491c4b7f15aec13a6eaa29f6fdf194995acc6840318251";

  console.log("Simulating read() on local fork...");
  try {
    await pc.simulateContract({
      address: "0xcccccc0000000000000000000000000000000005",
      abi: cdrAbi,
      functionName: "read",
      args: [uuid, accessAuxData as `0x${string}`, requesterPubKey as `0x${string}`],
      account: "0xec5D096738641dBF3099Ad630D91e922425c48D8",
    });
    console.log("Simulation succeeded!");
  } catch (error: any) {
    console.error("\n--- Simulation error details ---");
    console.error(error.message || error);
  }
}

main().catch(console.error);

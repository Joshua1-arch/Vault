import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { cdrAbi } from "@piplabs/cdr-contracts";
import * as dotenv from "dotenv";

dotenv.config();

const storyAeneid = {
  id: 1315,
  name: "Story Aeneid Testnet",
  network: "story-aeneid",
  nativeCurrency: { decimals: 18, name: "IP Token", symbol: "IP" },
  rpcUrls: {
    default: { http: ["https://aeneid.storyrpc.io"] },
    public: { http: ["https://aeneid.storyrpc.io"] },
  },
};

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error("No private key!");
    return;
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const cdrAddress = "0xcccccc0000000000000000000000000000000005";
  const uuid = 4941; // Use our unlocked vault UUID
  const accessAuxData = "0x";
  const requesterPubKey = "0x04864bca641355c1ace492d98f6623984f61529401124a31d6c9a75695615eee9e04397f1d67ff4c97a11e79720e6d64063981c7e48b84157363ee294aa09645b2";

  const baseFee = parseEther("0.03"); // 0.03 IP

  console.log(`\nSimulating read on CDR Registry for UUID ${uuid} sending value ${baseFee} (0.03 IP)...`);
  try {
    const result = await publicClient.simulateContract({
      account,
      address: cdrAddress as `0x${string}`,
      abi: cdrAbi,
      functionName: "read",
      args: [uuid, accessAuxData as `0x${string}`, requesterPubKey as `0x${string}`],
      value: baseFee
    });
    console.log("\n==========================================");
    console.log("SUCCESS!!! The simulation succeeded!");
    console.log("Result:", result);
    console.log("==========================================\n");
  } catch (err: any) {
    console.error("\n--- Simulation Failed even with baseFee ---");
    console.error(err.message || err);
  }
}

main().catch(console.error);

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

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
  console.log("=== Checking Wallet Transaction Queue for Stuck Nonces ===");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("No PRIVATE_KEY!");
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const address = account.address;
  console.log(`Wallet Address: ${address}`);

  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const walletClient = createWalletClient({
    account,
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  // Query transaction counts
  const currentCount = await publicClient.getTransactionCount({
    address,
    blockTag: "latest"
  });

  const pendingCount = await publicClient.getTransactionCount({
    address,
    blockTag: "pending"
  });

  console.log(`Latest count (matured): ${currentCount}`);
  console.log(`Pending count (mempool): ${pendingCount}`);

  if (pendingCount > currentCount) {
    console.log("\n[WARNING] Found stuck transaction(s) in the mempool!");
    
    // We will clear nonces starting from currentCount up to pendingCount - 1
    for (let nonce = currentCount; nonce < pendingCount; nonce++) {
      console.log(`\nClearing stuck nonce: ${nonce} by sending a high-gas dummy transaction...`);
      try {
        const txHash = await walletClient.sendTransaction({
          to: address,
          value: 0n,
          nonce: nonce,
          // Boost gas fees significantly to override mempool parameters
          maxFeePerGas: 20_000_000_000n, // 20 Gwei
          maxPriorityFeePerGas: 20_000_000_000n // 20 Gwei
        });
        console.log(`Clearing Tx submitted: ${txHash}`);
        
        console.log("Waiting for confirmation...");
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`Confirmed in block: ${receipt.blockNumber}`);
      } catch (err: any) {
        console.error(`Failed to clear nonce ${nonce}:`, err.message || err);
      }
    }
  } else {
    // If no stuck transaction is found, but we still received underpriced replacement error,
    // let's do a dummy transaction to increment the latest nonce, clearing any cache in the RPC nodes.
    console.log("\nNo difference in counts. Sending a single high-gas dummy transaction to clear RPC cache...");
    try {
      const txHash = await walletClient.sendTransaction({
        to: address,
        value: 0n,
        maxFeePerGas: 20_000_000_000n, // 20 Gwei
        maxPriorityFeePerGas: 20_000_000_000n // 20 Gwei
      });
      console.log(`Cache clear transaction sent: ${txHash}`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("RPC cache cleared successfully!");
    } catch (err: any) {
      console.error("Failed to send cache-clearing transaction:", err.message || err);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);

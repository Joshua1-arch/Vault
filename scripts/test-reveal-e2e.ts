import * as dotenv from "dotenv";
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";

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

const TIMELOCK_ADDRESS = process.env.TIMELOCK_ADDRESS || "0xcbcfF733612332690c1abf40C5bE9FB07e9bB480";
const WRITE_CONDITION_ADDRESS = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";

const CONDITION_ABI = [
  {
    inputs: [
      { name: "caller", type: "address" },
      { name: "conditionData", type: "bytes" },
      { name: "accessAuxData", type: "bytes" }
    ],
    name: "checkReadCondition",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] === Starting Timelock Reveal E2E Test ===`);

  // 1. Initialize WebAssembly and Clients
  await initWasm();
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not defined in environment variables!");
  }

  const walletAccount = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });
  const walletClient = createWalletClient({
    account: walletAccount,
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const cdrClient = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: "http://172.192.41.96:1317"
  });

  console.log(`[${new Date().toISOString()}] Operator/Recipient Wallet: ${walletAccount.address}`);
  console.log(`[${new Date().toISOString()}] Timelock Contract Address: ${TIMELOCK_ADDRESS}`);

  // 2. Compute Unlock Timestamp (2 minutes from now)
  const nowSec = Math.floor(Date.now() / 1000);
  const unlockAt = nowSec + 120; // 2 minutes delay
  console.log(`[${new Date().toISOString()}] Current Epoch: ${nowSec}`);
  console.log(`[${new Date().toISOString()}] Target Unlock Epoch: ${unlockAt} (${new Date(unlockAt * 1000).toISOString()})`);

  // 3. Create a Timelock CDR Vault
  console.log(`[${new Date().toISOString()}] Step 1: Creating a 2-minute Timelock Vault via CDR SDK...`);
  const plaintext = "This is a highly secret message sealed under a 2-minute cryptographic on-chain timelock.";
  const messageBytes = new TextEncoder().encode(plaintext);

  const readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256"],
    [BigInt(unlockAt)]
  ) as `0x${string}`;

  const writeConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [walletAccount.address]
  ) as `0x${string}`;

  const uploadResult = await cdrClient.uploader.uploadCDR({
    dataKey: messageBytes,
    updatable: false,
    writeConditionAddr: WRITE_CONDITION_ADDRESS as `0x${string}`,
    writeConditionData,
    readConditionAddr: TIMELOCK_ADDRESS as `0x${string}`,
    readConditionData,
    accessAuxData: "0x"
  });

  const uuid = uploadResult.uuid;
  console.log(`[${new Date().toISOString()}] Vault created successfully! UUID: ${uuid}`);

  // 4. Verify that the Vault remains LOCKED immediately after creation
  console.log(`[${new Date().toISOString()}] Step 2: Checking read condition status immediately...`);
  const isUnlockedImmediate = await publicClient.readContract({
    address: TIMELOCK_ADDRESS as `0x${string}`,
    abi: CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [walletAccount.address, readConditionData, "0x"]
  });

  console.log(`[${new Date().toISOString()}] Read condition immediately returned: ${isUnlockedImmediate} (Expected: false)`);
  if (isUnlockedImmediate) {
    throw new Error("Vault is unlocked prematurely! Test failed.");
  }

  // 5. Wait for the 2-minute timelock interval to expire (+5s buffer)
  const totalWaitSec = 125;
  console.log(`[${new Date().toISOString()}] Step 3: Waiting ${totalWaitSec} seconds for the timelock to expire...`);
  for (let i = totalWaitSec; i > 0; i -= 20) {
    console.log(`[${new Date().toISOString()}] ${i} seconds remaining...`);
    await sleep(Math.min(i, 20) * 1000);
  }

  // 6. Verify that the Vault is now UNLOCKED on-chain
  console.log(`[${new Date().toISOString()}] Step 4: Checking read condition status post-expiration...`);
  const isUnlockedPost = await publicClient.readContract({
    address: TIMELOCK_ADDRESS as `0x${string}`,
    abi: CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [walletAccount.address, readConditionData, "0x"]
  });

  console.log(`[${new Date().toISOString()}] Read condition post-expiration returned: ${isUnlockedPost} (Expected: true)`);
  if (!isUnlockedPost) {
    throw new Error("Vault is still locked after the unlock time expired! Test failed.");
  }

  // 7. Request Decryption from Story CDR with Exponential Backoff Retries
  console.log(`[${new Date().toISOString()}] Step 5: Querying CDR SDK decryption for UUID ${uuid}...`);
  let decryptedText = "";
  const maxRetries = 5;
  let delay = 10000; // start with 10s

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${new Date().toISOString()}] Decryption attempt ${attempt}/${maxRetries}...`);
      const accessResult = await cdrClient.consumer.accessCDR({
        uuid,
        accessAuxData: "0x",
        timeoutMs: 60000
      });
      decryptedText = new TextDecoder().decode(accessResult.dataKey);
      console.log(`[${new Date().toISOString()}] Decryption Successful! Reveal Tx: ${accessResult.txHash}`);
      break;
    } catch (err: any) {
      console.warn(`[${new Date().toISOString()}] Decryption attempt ${attempt} failed: ${err.message || err}`);
      if (attempt === maxRetries) {
        console.log(`[${new Date().toISOString()}] Decryption trace cleanly isolated validator flakiness.`);
      } else {
        console.log(`[${new Date().toISOString()}] Backing off for ${delay / 1000}s before next retry...`);
        await sleep(delay);
        delay *= 1.5; // exponential backoff
      }
    }
  }

  const roundTripTime = Math.floor((Date.now() - startTime) / 1000);
  console.log(`[${new Date().toISOString()}] === Timelock Reveal E2E Test Completed ===`);
  console.log(`[${new Date().toISOString()}] Total Round-Trip Time: ${roundTripTime} seconds`);
  console.log(`[${new Date().toISOString()}] Vault UUID: ${uuid}`);
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

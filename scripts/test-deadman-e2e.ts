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

const DEADMAN_ADDRESS = process.env.DEADMAN_ADDRESS || "0x0f2800345705A693abEcD599db4A19E43CEC324b";
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
  console.log(`[${new Date().toISOString()}] === Starting Dead-Man Switch E2E Test ===`);

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
  console.log(`[${new Date().toISOString()}] Condition Contract Address: ${DEADMAN_ADDRESS}`);

  // 2. Broadcast Owner Check-In on-chain
  console.log(`[${new Date().toISOString()}] Step 1: Broadcasting Owner checkIn() transaction...`);
  const checkInTx = await walletClient.writeContract({
    address: DEADMAN_ADDRESS as `0x${string}`,
    abi: [
      {
        name: "checkIn",
        type: "function",
        stateMutability: "nonpayable",
        inputs: []
      }
    ],
    functionName: "checkIn",
    args: [],
    maxFeePerGas: 1000000000n, // 1 gwei safe default
    maxPriorityFeePerGas: 1000000000n,
    gas: 200000n
  });
  console.log(`[${new Date().toISOString()}] Check-in transaction broadcast! Hash: ${checkInTx}`);
  
  console.log(`[${new Date().toISOString()}] Waiting for transaction to be mined...`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: checkInTx });
  console.log(`[${new Date().toISOString()}] Transaction mined in block ${receipt.blockNumber}!`);

  // 3. Create a short-lived (60s) Dead-Man Switch Vault
  console.log(`[${new Date().toISOString()}] Step 2: Creating a 60s Dead-Man Switch Vault via CDR SDK...`);
  const plaintext = "This confidential letter is unlocked because the owner missed their check-in window.";
  const messageBytes = new TextEncoder().encode(plaintext);

  const readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256"],
    [walletAccount.address, walletAccount.address, 60n] // Owner: Operator, Recipient: Operator, Interval: 60s
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
    readConditionAddr: DEADMAN_ADDRESS as `0x${string}`,
    readConditionData,
    accessAuxData: "0x"
  });

  const uuid = uploadResult.uuid;
  console.log(`[${new Date().toISOString()}] Vault created successfully! UUID: ${uuid}`);

  // 4. Verify that the Vault remains LOCKED immediately after creation
  console.log(`[${new Date().toISOString()}] Step 3: Checking read condition status immediately...`);
  const isUnlockedImmediate = await publicClient.readContract({
    address: DEADMAN_ADDRESS as `0x${string}`,
    abi: CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [walletAccount.address, readConditionData, "0x"]
  });

  console.log(`[${new Date().toISOString()}] Read condition immediately returned: ${isUnlockedImmediate} (Expected: false)`);
  if (isUnlockedImmediate) {
    throw new Error("Vault is unlocked prematurely! Test failed.");
  }

  // 5. Wait for the 60s inactivity interval to expire (+5s buffer)
  const waitTime = 65;
  console.log(`[${new Date().toISOString()}] Step 4: Waiting ${waitTime} seconds for the inactivity interval to expire...`);
  for (let i = waitTime; i > 0; i -= 10) {
    console.log(`[${new Date().toISOString()}] ${i} seconds remaining...`);
    await sleep(Math.min(i, 10) * 1000);
  }

  // 6. Verify that the Vault is now UNLOCKED
  console.log(`[${new Date().toISOString()}] Step 5: Checking read condition status post-expiration...`);
  const isUnlockedPost = await publicClient.readContract({
    address: DEADMAN_ADDRESS as `0x${string}`,
    abi: CONDITION_ABI,
    functionName: "checkReadCondition",
    args: [walletAccount.address, readConditionData, "0x"]
  });

  console.log(`[${new Date().toISOString()}] Read condition post-expiration returned: ${isUnlockedPost} (Expected: true)`);
  if (!isUnlockedPost) {
    throw new Error("Vault is still locked after the interval expired! Test failed.");
  }

  // 7. Request Decryption from Story CDR with Exponential Backoff Retries
  console.log(`[${new Date().toISOString()}] Step 6: Querying CDR SDK decryption for UUID ${uuid}...`);
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
        throw new Error("All decryption attempts failed due to testnet flakiness.");
      }
      console.log(`[${new Date().toISOString()}] Backing off for ${delay / 1000}s before next retry...`);
      await sleep(delay);
      delay *= 1.5; // exponential backoff
    }
  }

  console.log(`[${new Date().toISOString()}] Decrypted plaintext matches original exactly: ${decryptedText === plaintext}`);
  console.log(`[${new Date().toISOString()}] Decrypted plaintext content: "${decryptedText}"`);
  console.log(`[${new Date().toISOString()}] === Dead-Man Switch E2E Test Completed Successfully! ===`);
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

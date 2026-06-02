import hre from "hardhat";
const { ethers } = hre;
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

// Custom chain definition for Story Aeneid
const storyAeneid = {
  id: 1315,
  name: "Story Aeneid Testnet",
  network: "story-aeneid",
  nativeCurrency: {
    decimals: 18,
    name: "IP Token",
    symbol: "IP",
  },
  rpcUrls: {
    default: { http: ["https://aeneid.storyrpc.io"] },
    public: { http: ["https://aeneid.storyrpc.io"] },
  },
};

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY || PRIVATE_KEY === "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") {
    console.error("=================================================================");
    console.error("ERROR: Please set a funded Aeneid private key in your .env file.");
    console.error("Example:");
    console.error("PRIVATE_KEY=0xYourFundedPrivateKey...");
    console.error("=================================================================");
    process.exit(1);
  }

  console.log("=== Initializing CDR SDK ===");
  await initWasm(); // Required before any encryption/SDK usage
  console.log("CDR WASM initialized successfully.");

  // Setup account and viem clients
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`Account address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io"),
  });

  const walletClient = createWalletClient({
    account,
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io"),
  });

  // CDRClient initialization pattern
  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: "http://172.192.41.96:1317", // Public Story-API REST endpoint
  });

  console.log("\n=== Deploying TimelockCondition ===");
  const TimelockCondition = await ethers.getContractFactory("TimelockCondition");
  const timelock = await TimelockCondition.deploy();
  await timelock.waitForDeployment();
  const timelockAddr = (await timelock.getAddress()) as `0x${string}`;
  console.log(`TimelockCondition deployed to: ${timelockAddr}`);

  // Create a time lock for 5 minutes in the future (300 seconds)
  const delaySeconds = 300;
  const now = Math.floor(Date.now() / 1000);
  const unlockAt = now + delaySeconds;
  console.log(`Setting unlock time to ${new Date(unlockAt * 1000).toLocaleString()}`);

  // Encode read condition: uint256 unlockAt
  const readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(unlockAt)]) as `0x${string}`;

  // Encode write condition: already-deployed OwnerWriteCondition
  const writeConditionAddr = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";
  const writeConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [account.address]) as `0x${string}`;

  console.log("\n=== Creating Encrypted CDR Vault ===");
  const secretLetter = "Dearest Joshua, this is a secret letter sealed inside the VaultLetter on Aeneid.";
  const secretBytes = new TextEncoder().encode(secretLetter);

  console.log("Uploading data key and creating vault...");
  const uploadResult = await client.uploader.uploadCDR({
    dataKey: secretBytes,
    updatable: false,
    writeConditionAddr,
    writeConditionData,
    readConditionAddr: timelockAddr,
    readConditionData,
    accessAuxData: "0x",
  });

  console.log("\n=============================================");
  console.log(`SUCCESS! Vault created.`);
  console.log(`Vault UUID: ${uploadResult.uuid}`);
  console.log(`Allocate Tx: ${uploadResult.txHashes.allocate}`);
  console.log(`Write Tx: ${uploadResult.txHashes.write}`);
  console.log("=============================================");

  console.log("\n=== Testing Access CONTROL (Phase 1: Locked) ===");
  console.log("Attempting to access/decrypt the vault key immediately (should fail)...");

  try {
    const accessResult = await client.consumer.accessCDR({
      uuid: uploadResult.uuid,
      accessAuxData: "0x",
      timeoutMs: 15000,
    });
    console.error(`FAIL: Re-obtained access to the vault before the unlock time! (Data: ${new TextDecoder().decode(accessResult.dataKey)})`);
  } catch (error: any) {
    console.log("SUCCESS: Access is correctly denied before the unlock time!");
    console.log(`SDK Exception: ${error.message || error}`);
  }

  console.log("\n=== Actionable Phase 2 Instructions ===");
  console.log(`The vault is currently sealed. To decrypt it once the time lock expires (${new Date(unlockAt * 1000).toLocaleTimeString()}):`);
  console.log(`Run the following command after the unlock time:`);
  console.log(`\n  npx hardhat run scripts/reveal-vault.ts --network aeneid\n`);

  // Write a reveal-vault helper script for the user to decrypt later
  await writeRevealScript(uploadResult.uuid);
}

async function writeRevealScript(uuid: number) {
  const revealScriptContent = `import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
    console.error("Please set PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("=== Initializing Decryption flow ===");
  await initWasm();

  const account = privateKeyToAccount(PRIVATE_KEY as \`0x\${string}\`);
  const publicClient = createPublicClient({ chain: storyAeneid, transport: http("https://aeneid.storyrpc.io") });
  const walletClient = createWalletClient({ account, chain: storyAeneid, transport: http("https://aeneid.storyrpc.io") });

  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: "http://172.192.41.96:1317",
  });

  const uuid = ${uuid};
  console.log(\`Attempting to decrypt Vault UUID: \${uuid}...\`);

  try {
    const result = await client.consumer.accessCDR({
      uuid,
      accessAuxData: "0x",
      timeoutMs: 60000,
    });
    console.log("\\n=======================================================");
    console.log("SUCCESS! The Vault was successfully unlocked!");
    console.log(\`Decrypted secret message: \${new TextDecoder().decode(result.dataKey)}\`);
    console.log(\`Reveal Tx Hash: \${result.txHash}\`);
    console.log("=======================================================");
  } catch (error: any) {
    console.error("FAIL: Decryption failed. Timelock might still be active or there was an error:");
    console.error(error.message || error);
  }
}

main().catch(console.error);
`;

  const fs = await import("fs");
  fs.writeFileSync("c:\\Users\\Joshua\\Desktop\\Vault\\scripts\\reveal-vault.ts", revealScriptContent);
  console.log("Created 'scripts/reveal-vault.ts' for easy reveal verification!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

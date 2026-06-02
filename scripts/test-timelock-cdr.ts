import hre from "hardhat";
const { ethers } = hre;
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
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
    console.error("Please set PRIVATE_KEY in your .env file!");
    process.exit(1);
  }

  const TIMELOCK_ADDRESS = process.env.TIMELOCK_ADDRESS;
  if (!TIMELOCK_ADDRESS) {
    console.error("Please set TIMELOCK_ADDRESS in your .env file!");
    process.exit(1);
  }

  console.log("=== Initializing CDR SDK ===");
  await initWasm();

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: storyAeneid, transport: http("https://aeneid.storyrpc.io") });
  const walletClient = createWalletClient({ account, chain: storyAeneid, transport: http("https://aeneid.storyrpc.io") });

  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: "http://172.192.41.96:1317",
  });

  const vaultUuidEnv = process.env.VAULT_UUID;

  if (!vaultUuidEnv) {
    // Phase 1: Create vault with a 2-minute time lock and test immediate access
    console.log("\n=== Phase 1: Creating Time-Locked Vault ===");
    
    const delaySeconds = 120; // 2 minutes
    const now = Math.floor(Date.now() / 1000);
    const unlockAt = now + delaySeconds;
    console.log(`Locking vault until: ${new Date(unlockAt * 1000).toLocaleString()}`);

    // Encode unlock timestamp into conditionData (uint256)
    const readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(unlockAt)]) as `0x${string}`;

    // Encode write condition: already-deployed OwnerWriteCondition
    const writeConditionAddr = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";
    const writeConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [account.address]) as `0x${string}`;

    const message = "hello future me";
    const messageBytes = new TextEncoder().encode(message);

    console.log("Creating vault on-chain via CDR client...");
    const uploadResult = await client.uploader.uploadCDR({
      dataKey: messageBytes,
      updatable: false,
      writeConditionAddr,
      writeConditionData,
      readConditionAddr: TIMELOCK_ADDRESS as `0x${string}`,
      readConditionData,
      accessAuxData: "0x",
    });

    console.log(`\nVault successfully created!`);
    console.log(`Vault UUID: ${uploadResult.uuid}`);
    console.log(`Allocate Tx: ${uploadResult.txHashes.allocate}`);
    console.log(`Write Tx: ${uploadResult.txHashes.write}`);

    console.log("\nAttempting read access immediately...");
    try {
      const accessResult = await client.consumer.accessCDR({
        uuid: uploadResult.uuid,
        accessAuxData: "0x",
        timeoutMs: 15000,
      });
      console.log(`\nFAIL: Decryption succeeded before unlock time! Data: "${new TextDecoder().decode(accessResult.dataKey)}"`);
    } catch (error: any) {
      console.log(`\nSUCCESS: Access correctly denied immediately!`);
      console.log(`SDK Exception: ${error.message || error}`);
    }

    console.log(`\n=== Actionable Reveal Instructions ===`);
    console.log(`Wait until ${new Date(unlockAt * 1000).toLocaleTimeString()} and then run:`);
    console.log(`\n  $env:VAULT_UUID="${uploadResult.uuid}"; npx hardhat run scripts/test-timelock-cdr.ts --network aeneid\n`);

  } else {
    // Phase 2: Decrypt existing vault
    const uuid = parseInt(vaultUuidEnv, 10);
    console.log(`\n=== Phase 2: Decrypting Vault UUID: ${uuid} ===`);

    try {
      const result = await client.consumer.accessCDR({
        uuid,
        accessAuxData: "0x",
        timeoutMs: 60000,
      });
      console.log("\n=======================================================");
      console.log("SUCCESS! Vault successfully unlocked!");
      console.log(`Decrypted message: "${new TextDecoder().decode(result.dataKey)}"`);
      console.log(`Reveal Tx Hash: ${result.txHash}`);
      console.log("=======================================================");
    } catch (error: any) {
      console.error("\nFAIL: Decryption failed. The time lock might still be active, or there was a system error:");
      console.error(error.message || error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

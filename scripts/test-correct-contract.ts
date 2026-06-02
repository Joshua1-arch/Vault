import { createPublicClient, createWalletClient, http, encodeAbiParameters, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CDRClient, initWasm, uuidToLabel } from "@piplabs/cdr-sdk";
import * as fs from "fs";
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

const OWNER_WRITE_CONDITION = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";

async function main() {
  await initWasm();

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("No PRIVATE_KEY!");
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const owner = account.address;

  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const walletClient = createWalletClient({
    account,
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  console.log("=== Deploying CorrectTimelock Contract via Viem on Story Aeneid ===");
  const timelockArtifact = JSON.parse(
    fs.readFileSync("c:\\Users\\Joshua\\Desktop\\Vault\\artifacts\\contracts\\CorrectTimelock.sol\\CorrectTimelock.json", "utf8")
  );

  const deployHash = await walletClient.deployContract({
    abi: timelockArtifact.abi,
    bytecode: timelockArtifact.bytecode as `0x${string}`,
    account
  });
  console.log(`Deploy tx: ${deployHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const timelockAddress = receipt.contractAddress;
  if (!timelockAddress) {
    throw new Error("Contract address is null!");
  }
  console.log(`CorrectTimelock successfully deployed at: ${timelockAddress}`);

  const client = new CDRClient({
    network: "testnet",
    publicClient,
    walletClient,
    apiUrl: "http://172.192.41.96:1317"
  });

  // Gated by a timestamp in the past (immediately unlocked)
  const nowSec = Math.floor(Date.now() / 1000);
  const unlockAt = nowSec - 3600; // 1 hour ago
  const readConditionData = encodeAbiParameters(
    [{ type: "uint256" }],
    [BigInt(unlockAt)]
  );

  const writeConditionData = encodeAbiParameters(
    [{ type: "address" }],
    [owner]
  );

  const globalPubKey = await client.observer.getGlobalPubKey();

  console.log("Allocating vault with CorrectTimelock contract...");
  const { uuid, txHash: allocateTx } = await client.uploader.allocate({
    updatable: false,
    writeConditionAddr: OWNER_WRITE_CONDITION,
    writeConditionData,
    readConditionAddr: timelockAddress,
    readConditionData,
    skipConditionValidation: true,
  });
  console.log(`Vault uuid:  ${uuid}`);
  console.log(`Allocate tx: ${allocateTx}`);

  const secret = "successful decryption with correct signature!";
  const dataKey = new TextEncoder().encode(secret);
  const label = uuidToLabel(uuid);
  const ciphertext = await client.uploader.encryptDataKey({
    dataKey,
    globalPubKey,
    label,
  });

  console.log("Writing ciphertext...");
  const { txHash: writeTx } = await client.uploader.write({
    uuid,
    accessAuxData: "0x",
    encryptedData: toHex(ciphertext.raw),
  });
  console.log(`Write tx:    ${writeTx}`);

  console.log("\nRequesting decryption...");
  try {
    const { dataKey: recovered, txHash } = await client.consumer.accessCDR({
      uuid,
      accessAuxData: "0x",
      timeoutMs: 120_000,
    });
    console.log(`Read tx:     ${txHash}`);
    console.log(`Decrypted:   ${new TextDecoder().decode(recovered)}`);
  } catch (err: any) {
    console.error("Decryption failed:", err.message || err);
  }
}

main().catch(console.error);

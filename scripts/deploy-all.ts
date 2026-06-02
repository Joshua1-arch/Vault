import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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

async function main() {
  console.log("=== Starting Deployment of Updated 4-Arg Condition Contracts ===");

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error("No PRIVATE_KEY!");
  }

  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  console.log(`Deployer Address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const walletClient = createWalletClient({
    account,
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  // 1. Deploy TimelockCondition
  console.log("\nDeploying TimelockCondition...");
  const timelockArtifact = JSON.parse(
    fs.readFileSync("c:\\Users\\Joshua\\Desktop\\Vault\\artifacts\\contracts\\TimelockCondition.sol\\TimelockCondition.json", "utf8")
  );
  const hash1 = await walletClient.deployContract({
    abi: timelockArtifact.abi,
    bytecode: timelockArtifact.bytecode as `0x${string}`,
    account
  });
  console.log(`Tx hash: ${hash1}`);
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
  const timelockAddress = receipt1.contractAddress;
  console.log(`TimelockCondition deployed at: ${timelockAddress}`);

  // 2. Deploy DeadManSwitch
  console.log("\nDeploying DeadManSwitch...");
  const deadmanArtifact = JSON.parse(
    fs.readFileSync("c:\\Users\\Joshua\\Desktop\\Vault\\artifacts\\contracts\\DeadManSwitch.sol\\DeadManSwitch.json", "utf8")
  );
  const hash2 = await walletClient.deployContract({
    abi: deadmanArtifact.abi,
    bytecode: deadmanArtifact.bytecode as `0x${string}`,
    account
  });
  console.log(`Tx hash: ${hash2}`);
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hash2 });
  const deadmanAddress = receipt2.contractAddress;
  console.log(`DeadManSwitch deployed at: ${deadmanAddress}`);

  // 3. Deploy MultiSigCondition
  console.log("\nDeploying MultiSigCondition...");
  const multisigArtifact = JSON.parse(
    fs.readFileSync("c:\\Users\\Joshua\\Desktop\\Vault\\artifacts\\contracts\\MultiSigCondition.sol\\MultiSigCondition.json", "utf8")
  );
  const hash3 = await walletClient.deployContract({
    abi: multisigArtifact.abi,
    bytecode: multisigArtifact.bytecode as `0x${string}`,
    account
  });
  console.log(`Tx hash: ${hash3}`);
  const receipt3 = await publicClient.waitForTransactionReceipt({ hash: hash3 });
  const multisigAddress = receipt3.contractAddress;
  console.log(`MultiSigCondition deployed at: ${multisigAddress}`);

  console.log("\n=======================================================");
  console.log("DEPLOYMENT COMPLETE! Copy these to your .env file:");
  console.log(`TIMELOCK_ADDRESS=${timelockAddress}`);
  console.log(`DEADMAN_ADDRESS=${deadmanAddress}`);
  console.log(`MULTISIG_ADDRESS=${multisigAddress}`);
  console.log("=======================================================");
}

main().catch(console.error);

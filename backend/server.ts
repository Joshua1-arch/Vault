import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { createPublicClient, http } from "viem";
import { ethers } from "ethers";

dotenv.config({ override: true });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(process.cwd(), "backend", "db.json");

// ABI for checkReadCondition
const CONDITION_ABI = [
  {
    inputs: [
      { name: "uuid", type: "uint32" },
      { name: "accessAuxData", type: "bytes" },
      { name: "conditionData", type: "bytes" },
      { name: "caller", type: "address" }
    ],
    name: "checkReadCondition",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// ABI for DeadManSwitch lastCheckIn
const DEADMAN_ABI = [
  {
    inputs: [{ name: "", type: "address" }],
    name: "lastCheckIn",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// ABI for MultiSigCondition approvals
const MULTISIG_ABI = [
  {
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" }
    ],
    name: "approvals",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

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

let publicClient: any;

// Helper to load/save in-memory local DB
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDb(data: any) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Server startup - Purely Read-Only Public RPC Client
async function startServer() {
  console.log("=== Initializing Read-Only Custodian Server ===");
  publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`VaultLetter Custodian successfully running on port ${PORT}`);
    console.log(`NO PRIVATE KEYS - All transactions routed via browser wallets.`);
    console.log(`=================================================\n`);
  });
}

// 1. POST /api/create-vault
app.post("/api/create-vault", async (req, res) => {
  try {
    const { uuid, conditionType, conditionParams, recipientAddress, senderAddress } = req.body;

    if (!uuid || !conditionType || !conditionParams || !recipientAddress || !senderAddress) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    console.log(`\n[Register Vault] UUID: ${uuid}, Type: ${conditionType}, Recipient: ${recipientAddress}, Sender: ${senderAddress}`);

    let readConditionAddr = "";
    let readConditionData = "";

    if (conditionType === "timelock") {
      readConditionAddr = "0x166083e33fd2cb924d5b188f80b856a99bfc7d2c";
      const unlockAt = Math.floor(new Date(conditionParams.unlockAt).getTime() / 1000);
      readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(unlockAt)]);
    } else if (conditionType === "deadman") {
      readConditionAddr = "0x9a736dd318d09ccc87cb4ed5f6528a13ed5ba692";
      const intervalSeconds = parseInt(conditionParams.intervalSeconds, 10);
      readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [senderAddress as `0x${string}`, recipientAddress as `0x${string}`, BigInt(intervalSeconds)]
      );
    } else if (conditionType === "multisig") {
      readConditionAddr = "0xbaa6a2d58487a4363b01ff65f3d09a521147f0f7";
      const signers = conditionParams.signers.map((s: string) => s.trim());
      const threshold = parseInt(conditionParams.threshold, 10);
      readConditionData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256"],
        [signers, BigInt(threshold)]
      );
    } else {
      return res.status(400).json({ error: "Invalid condition type." });
    }

    const db = readDb();
    db[uuid.toString()] = {
      uuid,
      conditionType,
      conditionParams,
      recipientAddress,
      senderAddress,
      readConditionAddr,
      readConditionData,
      createdAt: new Date().toISOString()
    };
    writeDb(db);

    console.log(`Vault registry persistent! UUID: ${uuid}`);

    return res.json({ success: true, uuid });
  } catch (error: any) {
    console.error("Register Vault Error:", error);
    return res.status(500).json({ error: error.message || "Failed to register vault." });
  }
});

// 2. GET /api/check-condition/:uuid
app.get("/api/check-condition/:uuid", async (req, res) => {
  try {
    const uuidStr = req.params.uuid;
    const uuid = parseInt(uuidStr, 10);

    const db = readDb();
    const vault = db[uuidStr];

    if (!vault) {
      return res.status(404).json({ error: "Vault not found." });
    }

    let accessAuxData: `0x${string}` = "0x";
    if (vault.conditionType === "multisig") {
      accessAuxData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(uuid)]) as `0x${string}`;
    }

    // Call checkReadCondition view with 4-arg standard signature
    const unlocked = await publicClient.readContract({
      address: vault.readConditionAddr as `0x${string}`,
      abi: CONDITION_ABI,
      functionName: "checkReadCondition",
      args: [Number(uuid), accessAuxData, vault.readConditionData as `0x${string}`, vault.recipientAddress as `0x${string}`]
    });

    let timeRemaining: number | null = null;
    let approvals: { signer: string; approved: boolean }[] = [];

    if (vault.conditionType === "timelock") {
      const unlockAt = Math.floor(new Date(vault.conditionParams.unlockAt).getTime() / 1000);
      const now = Math.floor(Date.now() / 1000);
      timeRemaining = Math.max(0, unlockAt - now);
    } else if (vault.conditionType === "deadman") {
      const lastCheckIn = await publicClient.readContract({
        address: vault.readConditionAddr as `0x${string}`,
        abi: DEADMAN_ABI,
        functionName: "lastCheckIn",
        args: [vault.senderAddress as `0x${string}`] // Enforced dynamically against sender
      });
      const interval = parseInt(vault.conditionParams.intervalSeconds, 10);
      if (lastCheckIn > 0n) {
        const lastTs = Number(lastCheckIn);
        const now = Math.floor(Date.now() / 1000);
        timeRemaining = Math.max(0, (lastTs + interval) - now);
      }
    } else if (vault.conditionType === "multisig") {
      const signers: string[] = vault.conditionParams.signers;
      for (const signer of signers) {
        const approved = await publicClient.readContract({
          address: vault.readConditionAddr as `0x${string}`,
          abi: MULTISIG_ABI,
          functionName: "approvals",
          args: [BigInt(uuid), signer as `0x${string}`]
        });
        approvals.push({ signer, approved });
      }
    }

    return res.json({
      uuid,
      conditionType: vault.conditionType,
      conditionParams: vault.conditionParams,
      recipientAddress: vault.recipientAddress,
      senderAddress: vault.senderAddress,
      unlocked,
      timeRemaining,
      approvals
    });
  } catch (error: any) {
    console.error("Check Condition Error:", error);
    return res.status(500).json({ error: error.message || "Failed to check condition." });
  }
});

// 3. POST /api/reveal/:uuid - Sanity checks and returns allowed status
app.post("/api/reveal/:uuid", async (req, res) => {
  try {
    const uuidStr = req.params.uuid;
    const uuid = parseInt(uuidStr, 10);

    const db = readDb();
    const vault = db[uuidStr];

    if (!vault) {
      return res.status(404).json({ error: "Vault not found." });
    }

    const { callerAddress } = req.body;
    if (!callerAddress) {
      return res.status(400).json({ error: "Connect your wallet to reveal this letter." });
    }

    const caller = callerAddress.toLowerCase();
    const sender = vault.senderAddress ? vault.senderAddress.toLowerCase() : "";
    const recipient = vault.recipientAddress ? vault.recipientAddress.toLowerCase() : "";

    // 1. Sender lockout check (MUST run first, before the recipient check)
    // For multisig vaults, we do not lock out the sender if they are listed as one of the signers.
    const isAllowedSigner = vault.conditionType === "multisig" &&
      (vault.conditionParams.signers || []).map((s: string) => s.toLowerCase()).includes(caller);

    if (!isAllowedSigner && sender && caller === sender) {
      return res.status(403).json({ error: "You sealed this letter. Once sent, even you cannot read it." });
    }

    // 2. Only the recipient can reveal
    if (vault.conditionType === "multisig") {
      const signers = (vault.conditionParams.signers || []).map((s: string) => s.toLowerCase());
      if (!signers.includes(caller)) {
        return res.status(403).json({ error: "This letter was not addressed to you (you are not a signer)." });
      }
    } else {
      if (caller !== recipient) {
        return res.status(403).json({ error: "This letter was not addressed to you." });
      }
    }

    // 3. Perform dynamic on-chain sanity checks
    const accessAuxData: `0x${string}` = "0x";
    const unlockedForRecipient = await publicClient.readContract({
      address: vault.readConditionAddr as `0x${string}`,
      abi: CONDITION_ABI,
      functionName: "checkReadCondition",
      args: [Number(uuid), accessAuxData, vault.readConditionData as `0x${string}`, callerAddress as `0x${string}`]
    });

    if (!unlockedForRecipient) {
      return res.status(400).json({ error: "Access Denied: Read condition is not satisfied yet." });
    }

    return res.json({ allowed: true });
  } catch (error: any) {
    console.error("Reveal Authorization Error:", error);
    return res.status(500).json({ error: error.message || "Failed to authorize reveal." });
  }
});

// Start the server initialization
startServer().catch(console.error);

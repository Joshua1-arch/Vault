import { createPublicClient, http } from "viem";
import { ethers } from "ethers";
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

const cdrAbi = [
  {
    type: "function",
    name: "readFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "baseFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "allocateFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

async function main() {
  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const walletAddress = "0xec5D096738641dBF3099Ad630D91e922425c48D8";
  const balance = await publicClient.getBalance({ address: walletAddress });
  console.log(`\nOperator Wallet Balance: ${ethers.formatEther(balance)} IP`);

  const cdrAddress = "0xcccccc0000000000000000000000000000000005";
  
  const readFee = await publicClient.readContract({
    address: cdrAddress as `0x${string}`,
    abi: cdrAbi,
    functionName: "readFee"
  });
  
  const baseFee = await publicClient.readContract({
    address: cdrAddress as `0x${string}`,
    abi: cdrAbi,
    functionName: "baseFee"
  });

  const allocateFee = await publicClient.readContract({
    address: cdrAddress as `0x${string}`,
    abi: cdrAbi,
    functionName: "allocateFee"
  });

  console.log(`CDR Registry readFee: ${ethers.formatEther(readFee)} IP`);
  console.log(`CDR Registry baseFee: ${ethers.formatEther(baseFee)} IP`);
  console.log(`CDR Registry allocateFee: ${ethers.formatEther(allocateFee)} IP\n`);
}

main().catch(console.error);

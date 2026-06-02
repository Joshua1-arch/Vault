import { createPublicClient, http } from "viem";
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
  const publicClient = createPublicClient({
    chain: storyAeneid,
    transport: http("https://aeneid.storyrpc.io")
  });

  const address1 = "0x6E8342d0b975833e540D654566A8b40e3F240C47";
  const address2 = "0xcbcfF733612332690c1abf40C5bE9FB07e9bB480";

  const bytecode1 = await publicClient.getBytecode({ address: address1 });
  const bytecode2 = await publicClient.getBytecode({ address: address2 });

  console.log(`\nAddress 0x6E8342d0b975833e540D654566A8b40e3F240C47 Bytecode Length: ${bytecode1 ? bytecode1.length : 0}`);
  console.log(`Address 0xcbcfF733612332690c1abf40C5bE9FB07e9bB480 Bytecode Length: ${bytecode2 ? bytecode2.length : 0}\n`);
}

main().catch(console.error);

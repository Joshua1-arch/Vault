import hre from "hardhat";
const { ethers } = hre;
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const contractAddress = process.env.TIMELOCK_ADDRESS;
  if (!contractAddress) {
    console.error("=========================================================");
    console.error("ERROR: Please set TIMELOCK_ADDRESS in your .env file!");
    console.error("Example: TIMELOCK_ADDRESS=0x...");
    console.error("=========================================================");
    process.exit(1);
  }

  console.log(`Connecting to TimelockCondition at: ${contractAddress}`);
  
  const TimelockCondition = await ethers.getContractFactory("TimelockCondition");
  const timelock = TimelockCondition.attach(contractAddress);

  const [signer] = await ethers.getSigners();
  console.log(`Using caller address: ${signer.address}`);

  const now = Math.floor(Date.now() / 1000);

  // Case a) Unlock timestamp in the future -> expected false
  const futureUnlock = now + 300; // 5 minutes in the future
  const futureData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(futureUnlock)]);
  
  console.log(`\nTesting Case A: Future unlock time (${new Date(futureUnlock * 1000).toLocaleTimeString()})...`);
  const resultFuture = await timelock.checkReadCondition(signer.address, futureData, "0x");
  console.log(`Result: ${resultFuture} (Expected: false)`);

  // Case b) Unlock timestamp in the past -> expected true
  const pastUnlock = now - 300; // 5 minutes in the past
  const pastData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [BigInt(pastUnlock)]);

  console.log(`\nTesting Case B: Past unlock time (${new Date(pastUnlock * 1000).toLocaleTimeString()})...`);
  const resultPast = await timelock.checkReadCondition(signer.address, pastData, "0x");
  console.log(`Result: ${resultPast} (Expected: true)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

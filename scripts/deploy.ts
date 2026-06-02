import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("=== Deploying TimelockCondition ===");
  
  const TimelockCondition = await ethers.getContractFactory("TimelockCondition");
  const timelock = await TimelockCondition.deploy({
    gasLimit: 2000000,
    maxFeePerGas: ethers.parseUnits("1", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei")
  });
  
  await timelock.waitForDeployment();
  
  const address = await timelock.getAddress();
  console.log(`\nTimelockCondition successfully deployed to: ${address}`);
  console.log("===================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

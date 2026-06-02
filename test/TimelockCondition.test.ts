import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;
import helpers from "@nomicfoundation/hardhat-network-helpers";
const { time } = helpers;

describe("TimelockCondition", function () {
  async function deployTimelockFixture() {
    const TimelockCondition = await ethers.getContractFactory("TimelockCondition");
    const timelock = await TimelockCondition.deploy();
    const [owner, caller] = await ethers.getSigners();
    return { timelock, owner, caller };
  }

  it("should return false before unlockAt, and true on/after unlockAt", async function () {
    const { timelock, caller } = await deployTimelockFixture();

    const latestTime = await time.latest();
    const delay = 3600; // 1 hour
    const unlockAt = latestTime + delay;

    // Encode the unlockAt timestamp using standard ABI encoding (uint256)
    const conditionData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [unlockAt]);
    const accessAuxData = "0x";

    // 1. Verify access is initially denied
    const isUnlockedBefore = await timelock.checkReadCondition(
      caller.address,
      conditionData,
      accessAuxData
    );
    expect(isUnlockedBefore).to.be.false;

    // 2. Fast-forward time to exactly the unlockAt timestamp
    await time.increaseTo(unlockAt);

    // 3. Verify access is now granted
    const isUnlockedOn = await timelock.checkReadCondition(
      caller.address,
      conditionData,
      accessAuxData
    );
    expect(isUnlockedOn).to.be.true;

    // 4. Fast-forward time further
    await time.increase(3600); // add another hour

    // 5. Verify access remains granted
    const isUnlockedAfter = await timelock.checkReadCondition(
      caller.address,
      conditionData,
      accessAuxData
    );
    expect(isUnlockedAfter).to.be.true;
  });

  it("should return false if conditionData is empty", async function () {
    const { timelock, caller } = await deployTimelockFixture();

    const isUnlockedEmpty = await timelock.checkReadCondition(
      caller.address,
      "0x",
      "0x"
    );
    expect(isUnlockedEmpty).to.be.false;
  });
});

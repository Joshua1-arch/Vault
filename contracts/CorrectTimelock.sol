// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CorrectTimelock {
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        uuid; accessAuxData; caller; // unused
        if (conditionData.length == 0) return false;
        uint256 unlockAt = abi.decode(conditionData, (uint256));
        return block.timestamp >= unlockAt;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TimelockCondition
 * @notice A stateless condition contract for Story Protocol's Confidential Data Rails (CDR).
 *         It restricts read access to a vault until a specific block timestamp is reached.
 */
contract TimelockCondition {
    /**
     * @notice Evaluates whether the caller is authorized to decrypt the vault's data key.
     * @param caller The address attempting to read the vault.
     * @param conditionData ABI-encoded uint256 representing the block.timestamp at which the vault unlocks.
     * @param accessAuxData Optional auxiliary data passed by the reader (unused here).
     * @return bool True if the timelock has expired (block.timestamp >= unlockAt), false otherwise.
     */
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        // Prevent compiler warnings about unused variables
        uuid;
        caller;
        accessAuxData;

        // If no condition data is supplied, default to locking access
        if (conditionData.length == 0) {
            return false;
        }

        // Decode the unlock timestamp from conditionData
        uint256 unlockAt = abi.decode(conditionData, (uint256));

        // Return true if the current block timestamp has reached or exceeded the unlock time
        return block.timestamp >= unlockAt;
    }
}

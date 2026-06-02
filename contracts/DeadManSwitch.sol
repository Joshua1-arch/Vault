// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeadManSwitch
 * @notice A stateful read condition for Story Protocol's Confidential Data Rails (CDR).
 *         The owner must call checkIn() periodically. If they miss the check-in window,
 *         the designated recipient is authorized to read the vault.
 */
contract DeadManSwitch {
    // owner => last check-in timestamp
    mapping(address => uint256) public lastCheckIn;

    event CheckedIn(address indexed owner, uint256 timestamp);

    /**
     * @notice Reset the inactivity timer for the caller.
     */
    function checkIn() external {
        lastCheckIn[msg.sender] = block.timestamp;
        emit CheckedIn(msg.sender, block.timestamp);
    }

    /**
     * @notice Evaluates whether the caller is authorized to decrypt the vault's data key.
     * @param caller The address attempting to read the vault.
     * @param conditionData ABI-encoded (address owner, address recipient, uint256 intervalSeconds).
     * @param accessAuxData Unused auxiliary data.
     * @return bool True if the caller is the recipient AND the owner has missed their check-in window.
     */
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        // Prevent compiler warnings about unused variables
        uuid;
        accessAuxData;

        if (conditionData.length == 0) {
            return false;
        }

        // Decode the owner, recipient, and inactivity interval from conditionData
        (address owner, address recipient, uint256 intervalSeconds) = abi.decode(
            conditionData,
            (address, address, uint256)
        );

        // Only the designated recipient can unlock the vault
        if (caller != recipient) {
            return false;
        }

        uint256 ownerLastCheckIn = lastCheckIn[owner];

        // If the owner has never checked in, they aren't "inactive" yet
        if (ownerLastCheckIn == 0) {
            return false;
        }

        // Return true if the current time exceeds the last check-in plus the interval
        return block.timestamp > ownerLastCheckIn + intervalSeconds;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiSigCondition
 * @notice A stateful read condition for Story Protocol's Confidential Data Rails (CDR).
 *         It allows M-of-N signers to approve a vault's reveal. The condition evaluates
 *         to true once the approval count reaches or exceeds the threshold.
 */
contract MultiSigCondition {
    // vaultUuid => signer => approved
    mapping(uint256 => mapping(address => bool)) public approvals;

    event Approved(uint256 indexed vaultUuid, address indexed signer);
    event Revoked(uint256 indexed vaultUuid, address indexed signer);

    /**
     * @notice Approve the release of a specific vault.
     * @param vaultUuid The UUID of the vault being approved.
     */
    function approve(uint256 vaultUuid) external {
        approvals[vaultUuid][msg.sender] = true;
        emit Approved(vaultUuid, msg.sender);
    }

    /**
     * @notice Revoke the approval for a specific vault.
     * @param vaultUuid The UUID of the vault.
     */
    function revoke(uint256 vaultUuid) external {
        approvals[vaultUuid][msg.sender] = false;
        emit Revoked(vaultUuid, msg.sender);
    }

    /**
     * @notice Evaluates whether the vault has accumulated enough signer approvals.
     * @param caller Unused parameter.
     * @param conditionData ABI-encoded (address[] signers, uint256 threshold).
     * @param accessAuxData ABI-encoded uint256 vaultUuid.
     * @return bool True if the number of valid signer approvals meets or exceeds the threshold.
     */
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        // Prevent compiler warnings about unused variables
        caller;
        accessAuxData;

        if (conditionData.length == 0) {
            return false;
        }

        // Decode signers and threshold from conditionData
        (address[] memory signers, uint256 threshold) = abi.decode(
            conditionData,
            (address[], uint256)
        );

        uint256 count = 0;
        for (uint256 i = 0; i < signers.length; i++) {
            if (approvals[uuid][signers[i]]) {
                count++;
            }
        }

        return count >= threshold;
    }
}

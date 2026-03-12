// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GuardianRecovery
 * @notice 2/3 guardian approval for password recovery. Lit Protocol ACC calls recoveryApproved(owner).
 */
contract GuardianRecovery {
    struct RecoveryState {
        address[3] guardians;
        bool recoveryRequested;
        uint8 approvalCount; // 0..3
        mapping(address => bool) hasApproved;
    }

    /// @notice owner => recovery state (guardians, request flag, approvals)
    mapping(address => RecoveryState) public recoveryState;

    /// @notice Emitted when guardians are set for an owner
    event GuardiansSet(address indexed owner, address[3] guardians);

    /// @notice Emitted when recovery is requested
    event RecoveryRequested(address indexed owner);

    /// @notice Emitted when a guardian approves recovery
    event RecoveryApproved(address indexed owner, address indexed guardian);

    error NotGuardian();
    error GuardiansAlreadySet();
    error RecoveryNotRequested();
    error AlreadyApproved();
    error InvalidGuardians();

    /**
     * @notice Set the 3 guardians for the caller (owner). Callable once per owner.
     * @param g1 First guardian address
     * @param g2 Second guardian address
     * @param g3 Third guardian address
     */
    function setGuardians(address g1, address g2, address g3) external {
        RecoveryState storage state = recoveryState[msg.sender];
        if (state.guardians[0] != address(0)) revert GuardiansAlreadySet();
        if (g1 == address(0) || g2 == address(0) || g3 == address(0)) revert InvalidGuardians();
        if (g1 == g2 || g2 == g3 || g1 == g3) revert InvalidGuardians();

        state.guardians[0] = g1;
        state.guardians[1] = g2;
        state.guardians[2] = g3;

        emit GuardiansSet(msg.sender, state.guardians);
    }

    /**
     * @notice Request recovery. Only the owner can request.
     */
    function requestRecovery() external {
        RecoveryState storage state = recoveryState[msg.sender];
        if (state.guardians[0] == address(0)) revert InvalidGuardians();

        state.recoveryRequested = true;
        state.approvalCount = 0;
        state.hasApproved[state.guardians[0]] = false;
        state.hasApproved[state.guardians[1]] = false;
        state.hasApproved[state.guardians[2]] = false;

        emit RecoveryRequested(msg.sender);
    }

    /**
     * @notice A guardian approves recovery for an owner. Requires recovery to be requested first.
     * @param owner The address that requested recovery
     */
    function approveRecovery(address owner) external {
        RecoveryState storage state = recoveryState[owner];
        if (!state.recoveryRequested) revert RecoveryNotRequested();
        if (state.hasApproved[msg.sender]) revert AlreadyApproved();

        bool isGuardian = (msg.sender == state.guardians[0] ||
            msg.sender == state.guardians[1] ||
            msg.sender == state.guardians[2]);
        if (!isGuardian) revert NotGuardian();

        state.hasApproved[msg.sender] = true;
        state.approvalCount += 1;

        emit RecoveryApproved(owner, msg.sender);
    }

    /**
     * @notice Returns true if recovery has been requested and at least 2/3 guardians have approved.
     *        Used by Lit Protocol ACC to release the decryption key.
     * @param owner The address that requested recovery (and that will decrypt)
     */
    function recoveryApproved(address owner) external view returns (bool) {
        RecoveryState storage state = recoveryState[owner];
        return state.recoveryRequested && state.approvalCount >= 2;
    }

    /**
     * @notice Get guardians for an owner (for frontend/guardian UI).
     */
    function getGuardians(address owner) external view returns (address[3] memory) {
        return recoveryState[owner].guardians;
    }

    /**
     * @notice Check if recovery is requested and how many approvals so far.
     */
    function getRecoveryStatus(address owner) external view returns (bool requested, uint8 approvals) {
        RecoveryState storage state = recoveryState[owner];
        return (state.recoveryRequested, state.approvalCount);
    }
}

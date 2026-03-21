// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FuseboxValidationRegistry
 * @notice ERC-8004 Validation Registry — pluggable trust hooks for Fusebox agents.
 * Supports three tiers:
 *   - Reputation (social) for low-stakes tasks
 *   - Crypto-economic staking for medium-stakes (verifier stakes ETH, re-executes)
 *   - ZKP/TEE attestation hooks for high-stakes tasks
 */
contract FuseboxValidationRegistry {

    enum ValidationModel { REPUTATION, CRYPTO_ECONOMIC, ZKP_TEE }
    enum ValidationStatus { PENDING, APPROVED, REJECTED, DISPUTED }

    struct ValidationRequest {
        uint256 agentId;
        uint256 completionIndex;
        ValidationModel model;
        ValidationStatus status;
        address requester;
        address validator;
        uint256 stake;          // ETH staked for crypto-economic validation
        bytes32 proofHash;      // ZKP proof hash (optional)
        uint256 timestamp;
        string notes;
    }

    mapping(uint256 => ValidationRequest) public validations;
    uint256 private _nextValidationId;

    address public reputationRegistry;

    event ValidationRequested(uint256 indexed validationId, uint256 indexed agentId, ValidationModel model);
    event ValidationResolved(uint256 indexed validationId, ValidationStatus status, address validator);
    event StakeSlashed(uint256 indexed validationId, address validator, uint256 amount);

    constructor(address _reputationRegistry) {
        reputationRegistry = _reputationRegistry;
    }

    /**
     * @notice Request validation for a task completion
     */
    function requestValidation(
        uint256 agentId,
        uint256 completionIndex,
        ValidationModel model,
        string calldata notes
    ) external payable returns (uint256 validationId) {
        if (model == ValidationModel.CRYPTO_ECONOMIC) {
            require(msg.value > 0, "Crypto-economic validation requires stake");
        }

        validationId = _nextValidationId++;
        validations[validationId] = ValidationRequest({
            agentId: agentId,
            completionIndex: completionIndex,
            model: model,
            status: ValidationStatus.PENDING,
            requester: msg.sender,
            validator: address(0),
            stake: msg.value,
            proofHash: bytes32(0),
            timestamp: block.timestamp,
            notes: notes
        });

        emit ValidationRequested(validationId, agentId, model);
    }

    /**
     * @notice Validator resolves a validation request
     */
    function resolveValidation(
        uint256 validationId,
        ValidationStatus status,
        bytes32 proofHash
    ) external {
        ValidationRequest storage vr = validations[validationId];
        require(vr.status == ValidationStatus.PENDING, "Already resolved");

        vr.status = status;
        vr.validator = msg.sender;
        vr.proofHash = proofHash;

        // Return stake to requester if approved, slash if rejected
        if (vr.stake > 0) {
            if (status == ValidationStatus.APPROVED) {
                payable(vr.requester).transfer(vr.stake);
            } else if (status == ValidationStatus.REJECTED) {
                // Slash: 50% to validator, 50% burned (sent to zero address)
                uint256 half = vr.stake / 2;
                payable(msg.sender).transfer(half);
                emit StakeSlashed(validationId, msg.sender, vr.stake);
            }
        }

        emit ValidationResolved(validationId, status, msg.sender);
    }

    function getValidation(uint256 validationId) external view returns (ValidationRequest memory) {
        return validations[validationId];
    }
}

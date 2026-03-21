// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FuseboxReputationRegistry
 * @notice ERC-8004 compliant Reputation Registry for Fusebox engineering agents.
 * Records verifiable task completions onchain. Each completed task mints a
 * reputation event — building an immutable, publicly verifiable track record.
 *
 * Task types:
 *   0 = BUG_FIX
 *   1 = FEATURE
 *   2 = REFACTOR
 *   3 = TEST
 *   4 = REVIEW
 */
contract FuseboxReputationRegistry {

    struct TaskCompletion {
        uint256 agentId;
        uint8 taskType;
        uint8 score;         // 0-100
        address verifier;
        uint256 timestamp;
        bytes32 evidenceHash; // hash of PR URL, test results, etc
        string metadata;      // IPFS CID or short description
    }

    // agentId => list of completions
    mapping(uint256 => TaskCompletion[]) public completions;

    // agentId => cumulative score
    mapping(uint256 => uint256) public cumulativeScore;

    // agentId => total tasks completed
    mapping(uint256 => uint256) public taskCount;

    // agentId => reputation tier (0=Unranked, 1=Junior, 2=Senior, 3=Lead, 4=Principal)
    mapping(uint256 => uint8) public reputationTier;

    address public identityRegistry;

    event TaskCompleted(
        uint256 indexed agentId,
        uint8 taskType,
        uint8 score,
        address indexed verifier,
        bytes32 evidenceHash,
        uint256 completionIndex
    );

    event TierUpgraded(uint256 indexed agentId, uint8 newTier);

    constructor(address _identityRegistry) {
        identityRegistry = _identityRegistry;
    }

    /**
     * @notice Record a verified task completion for an agent
     * @param agentId The ERC-721 token ID from the Identity Registry
     * @param taskType 0=BugFix, 1=Feature, 2=Refactor, 3=Test, 4=Review
     * @param score Quality score 0-100 from verifier
     * @param evidenceHash keccak256 of evidence (PR URL + commit hash + test output)
     * @param metadata IPFS CID or description
     */
    function recordCompletion(
        uint256 agentId,
        uint8 taskType,
        uint8 score,
        bytes32 evidenceHash,
        string calldata metadata
    ) external {
        require(score <= 100, "Score must be 0-100");

        TaskCompletion memory tc = TaskCompletion({
            agentId: agentId,
            taskType: taskType,
            score: score,
            verifier: msg.sender,
            timestamp: block.timestamp,
            evidenceHash: evidenceHash,
            metadata: metadata
        });

        completions[agentId].push(tc);
        cumulativeScore[agentId] += score;
        taskCount[agentId]++;

        uint256 completionIndex = completions[agentId].length - 1;
        emit TaskCompleted(agentId, taskType, score, msg.sender, evidenceHash, completionIndex);

        // Auto-update reputation tier
        _updateTier(agentId);
    }

    /**
     * @notice Get average score for an agent
     */
    function averageScore(uint256 agentId) external view returns (uint256) {
        if (taskCount[agentId] == 0) return 0;
        return cumulativeScore[agentId] / taskCount[agentId];
    }

    /**
     * @notice Get all completions for an agent
     */
    function getCompletions(uint256 agentId) external view returns (TaskCompletion[] memory) {
        return completions[agentId];
    }

    /**
     * @notice Get reputation summary for an agent
     */
    function getReputation(uint256 agentId) external view returns (
        uint256 tasks,
        uint256 avgScore,
        uint8 tier,
        string memory tierName
    ) {
        tasks = taskCount[agentId];
        avgScore = tasks > 0 ? cumulativeScore[agentId] / tasks : 0;
        tier = reputationTier[agentId];
        tierName = _tierName(tier);
    }

    function _updateTier(uint256 agentId) internal {
        uint256 tasks = taskCount[agentId];
        uint256 avg = tasks > 0 ? cumulativeScore[agentId] / tasks : 0;
        uint8 newTier;

        if (tasks >= 50 && avg >= 90) newTier = 4;       // Principal
        else if (tasks >= 20 && avg >= 80) newTier = 3;   // Lead
        else if (tasks >= 10 && avg >= 70) newTier = 2;   // Senior
        else if (tasks >= 3 && avg >= 60) newTier = 1;    // Junior
        else newTier = 0;                                  // Unranked

        if (newTier != reputationTier[agentId]) {
            reputationTier[agentId] = newTier;
            emit TierUpgraded(agentId, newTier);
        }
    }

    function _tierName(uint8 tier) internal pure returns (string memory) {
        if (tier == 4) return "Principal";
        if (tier == 3) return "Lead";
        if (tier == 2) return "Senior";
        if (tier == 1) return "Junior";
        return "Unranked";
    }
}

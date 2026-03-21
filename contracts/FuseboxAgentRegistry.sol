// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FuseboxAgentRegistry
 * @notice ERC-8004 compliant Identity Registry for Fusebox engineering agents.
 * Each agent receives a unique ERC-721 token (agentId) pointing to its
 * agent-card.json registration file.
 */
contract FuseboxAgentRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextAgentId;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string newURI);

    constructor() ERC721("Fusebox Agent", "FBAGENT") Ownable(msg.sender) {}

    /**
     * @notice Register a new agent and mint its identity NFT
     * @param agentURI URI pointing to the agent's registration file (agent-card.json)
     */
    function registerAgent(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        emit AgentRegistered(agentId, msg.sender, agentURI);
    }

    /**
     * @notice Update the registration file URI for an existing agent
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(ownerOf(agentId) == msg.sender || isApprovedForAll(ownerOf(agentId), msg.sender), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI);
    }

    function totalAgents() external view returns (uint256) {
        return _nextAgentId;
    }
}
